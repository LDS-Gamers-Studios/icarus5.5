// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const Twitch = require("@twurple/api");

const config = require("../config/config.json");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const api = require("../utils/streamingApis");
const bonusStreams = require("../data/streams.json");

const teamId = config.twitch.elTeam;
const Module = new Augur.Module();

const { assets: { colors }, twitchURL, extraLife: { isExtraLife } } = api;

const approvalText = "## Congratulations!\n" +
  `You've been added to the Approved Streamers list in LDSG! This allows going live notifications to show up in <#${u.sf.channels.general}>, and grants access to stream to voice channels.\n` +
  "This has been done automatically, but please double check that your correct Twitch name is saved in the database with `/ign view twitch`. If the link doesn't work, try `/ign set twitch YourTwitchUsername`.\n\n" +
  "While streaming, please remember the [Streaming Guidelines](<https://goo.gl/Pm3mwS>) and [LDSG Code of Conduct](<http://ldsgamers.com/code-of-conduct>).\n" +
  "-# LDSG may make changes to the Approved Streamers list from time to time at its discretion.";

const notEL = "Extra Life isn't quite ready yet! Try again in October.";

/******************
 * SLASH COMMANDS *
 ******************/

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeTeam(int) {
  if (!isExtraLife()) return int.reply({ content: notEL, flags: ["Ephemeral"] });
  await int.deferReply();

  const team = await api.extraLife.getTeam(int.client);
  if (!team) return int.editReply("Sorry, looks like the Extra Life API is down! Try later!").then(u.clean);

  /** @type {import("./twitchAlerts").AlertsShared | undefined} */
  const alertUtils = int.client.moduleManager.shared.get("twitchAlerts.js");
  if (!alertUtils) throw new Error("Couldn't find Twitch Altert Utils");

  const streams = await alertUtils.fetchExtraLifeStreams(team);
  const members = team.participants.map(p => {
    const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "");
    const stream = streams.find(s => username && s.userDisplayName === username);
    return { ...p, username, isLive: Boolean(stream), stream };
  });

  // sort by live, then donations, then name
  members.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.sumDonations !== b.sumDonations) return b.sumDonations - a.sumDonations;
    return a.displayName.localeCompare(b.displayName);
  });

  const total = members.reduce((p, cur) => p + cur.sumDonations, 0);

  const teamStrings = members.map(m => {
    const percent = api.round(100 * m.sumDonations / m.fundraisingGoal);
    let str = `**${m.displayName}**\n` +
      `$${m.sumDonations} / $${m.fundraisingGoal} (${percent}%)\n` +
      `**[[Donate]](${m.links.donate})**`;

    if (m.isLive) str += `\n### STREAM IS NOW LIVE\n[${m.stream?.title ?? "Watch Here"}](https://twitch.tv/${m.username})`;
    return str;
  });

  const nextMilestone = team.milestones.sort((a, b) => a.fundraisingGoal - b.fundraisingGoal)
    .find(m => m.fundraisingGoal > team.sumDonations);

  const wallOfText = `LDSG is raising money for Extra Life! We are currently at **$${total}** of our team's **$${team.fundraisingGoal}** goal for ${new Date().getFullYear()}. **That's ${api.round(100 * total / team.fundraisingGoal)}% of the way there!**\n\n` +
    "You can help by donating to one of the Extra Life Team members below.";

  const embed = u.embed().setTitle("LDSG Extra Life Team")
    .setThumbnail("https://assets.donordrive.com/extralife/images/fbLogo.jpg?v=202009241356")
    .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${teamId}#teamTabs`)
    .setDescription(`${wallOfText}\n\n${teamStrings.join("\n\n")}\n\n${nextMilestone ? `# Next Milestone:\n$${nextMilestone.fundraisingGoal} - ${nextMilestone.description}` : ""}`);

  return int.editReply({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchLive(int) {
  const ephemeral = u.ephemeralChannel(int, u.sf.channels.botSpam);
  await int.deferReply({ flags: ephemeral });

  const approved = int.guild.roles.cache.get(u.sf.roles.streaming.approved)?.members ?? new u.Collection();

  let igns = await u.db.ign.findMany(approved.map(m => m.id) ?? [], "twitch")
    .then(i => i.map(ign => ign.ign.toLowerCase()).concat(bonusStreams));

  // Add extra life team members if applicable
  /** @type {Discord.Collection<string, import("../utils/extralifeTypes").Participant>} */
  let elParticipants = new u.Collection();

  if (isExtraLife()) {
    const team = await api.extraLife.getTeam(int.client);

    elParticipants = new u.Collection(team?.participants.map(p => {
      const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "").toLowerCase() ?? "";
      return [username, p];
    }) ?? []);

    if (elParticipants.size > 0) igns = igns.concat([...elParticipants.keys()]);
  }

  igns = u.unique(igns);

  // This method only returns streams that are currently live
  /** @type {Promise<Twitch.HelixStream[]>[]} */
  const streamFetch = [];
  for (let i = 0; i < igns.length; i += 100) {
    const usernames = igns.slice(i, i + 100);
    streamFetch.push(api.twitch.streams.getStreamsByUserNames(usernames).catch(u.noop).then(s => s ?? []));
  }

  const streams = await Promise.all(streamFetch).then(p => p.flat());

  const embed = u.embed()
    .setTitle(`Currently Streaming in ${int.guild.name}`)
    .setColor(colors.twitch);

  const channels = [];
  const elChannels = [];

  /** @type {import("./twitchAlerts").AlertsShared | undefined} */
  const alertUtils = int.client.moduleManager.shared.get("twitchAlerts.js");
  if (!alertUtils) throw new Error("Couldn't find Twitch Altert Utils");

  for (const stream of streams) {
    const game = await api.fetchGameRating(stream.gameName, alertUtils.twitchGames);
    if (game.rating === "M - Mature 17+") continue;
    const participant = elParticipants.get(stream.userName);

    const data = {
      name: stream.userDisplayName,
      game,
      title: stream.title,
      url: twitchURL(stream.userDisplayName),
      participant
    };

    if (elParticipants.has(stream.userName)) elChannels.push(data);
    else channels.push(data);
  }

  channels.sort((a, b) => a.name.localeCompare(b.name));
  const lines = channels.map(ch => `**${ch.name} is playing ${ch.game.name || "something"}**\n[${ch.title}](${ch.url})`);
  let embeds = u.pagedEmbedsDescription(embed, lines);

  // Handle extra life embeds on their own
  if (elChannels.length > 0) {
    const elEmbed = u.embed()
      .setTitle(`Currently Streaming for Extra Life in ${int.guild.name}`)
      .setColor(colors.elGreen);

    const elLines = elChannels.map(ch => {
      const title = `**${ch.name} is playing ${ch.game.name || "something"}**\n[${ch.title}](${ch.url})`;
      const donation = `Goal Progress: $${ch.participant?.sumDonations}/$${ch.participant?.fundraisingGoal}`;
      return `${title}\n${donation}`;
    });

    embeds = embeds.concat(u.pagedEmbedsDescription(elEmbed, elLines));
  }

  return u.manyReplies(int, embeds.map(e => ({ embeds: [e] })), Boolean(ephemeral));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTwitchApplication(int) {
  if (int.member.roles.cache.has(u.sf.roles.streaming.approved)) return int.reply({ content: "You're already an approved streamer!", flags: ["Ephemeral"] });

  const agreement = u.MessageActionRow().addComponents([
    new u.Button({ customId: "streamerAgree", emoji: "✅", label: "Agree", style: Discord.ButtonStyle.Success }),
    new u.Button({ customId: "streamerDeny", emoji: "❌", label: "Deny", style: Discord.ButtonStyle.Secondary }),
  ]);

  const applicationEmbed = u.embed().setTitle("Approved Streamer Application (Part 1)")
    .setDescription(`By clicking \`Agree\`, you agree to follow the [Streaming Guidelines](https://goo.gl/Pm3mwS) and the [Code of Conduct](https://ldsg.io/code). Are you willing to follow these standards?`);

  return int.reply({ embeds: [applicationEmbed], components: [agreement], flags: ["Ephemeral"] });
}


/************************
 * APPLICATION HANDLERS *
 ************************/

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonStreamerAgree(int) {
  const ign = await u.db.ign.findOne(int.member.id, "twitch");

  // make modal
  const ignModal = new u.Modal()
    .setTitle("Approved Streamer Application (Part 2)")
    .setCustomId("streamerIgn")
    .addComponents(
      u.ModalActionRow().addComponents(
        new u.TextInput()
          .setLabel("Twitch Username (This will be saved as an IGN)")
          .setRequired(true)
          .setPlaceholder("https://twitch.tv/___this_part___")
          .setValue(ign?.ign || "")
          .setCustomId("username")
          .setStyle(Discord.TextInputStyle.Short)
      ),
      u.ModalActionRow().addComponents(
        new u.TextInput()
          .setLabel("What games do you usually stream?")
          .setRequired(true)
          .setCustomId("games")
          .setStyle(Discord.TextInputStyle.Short)
      )
    );

  return int.showModal(ignModal);
}

const approveButtons = u.MessageActionRow().addComponents(
  new u.Button({ customId: "approveStreamer", emoji: "✅", label: "Approve", style: Discord.ButtonStyle.Success }),
  new u.Button({ customId: "denyStreamer", emoji: "❌", label: "Deny", style: Discord.ButtonStyle.Secondary })
);

/** @param {Augur.GuildInteraction<"Modal">} int */
async function modalStreamerIgn(int) {
  // get inputs
  await int.deferUpdate();
  const name = int.fields.getTextInputValue("username");
  const games = int.fields.getTextInputValue("games");

  if (name.includes("twitch.tv/")) return int.editReply("It looks like you've included a URL in your Twitch username. We take care of that on our end, so please leave it out.");
  await u.db.ign.save(int.member.id, "twitch", name);

  // generate and send the request
  const embed = u.embed().setTitle("Approved Streamer Request")
    .setDescription(`${c.userBackup(int.member)} has requested to become an approved streamer. It's reccomended that you watch a stream or two of theirs before approving them.`)
    .setColor(c.colors.info)
    .setFooter({ text: int.member.id })
    .addFields(
      { name: "Twitch", value: `[${name}](https://twitch.tv/${name})` },
      { name: "Usual Games", value: games }
    );

  await int.client.getTextChannel(u.sf.channels.team.publicAffairs)?.send({ embeds: [embed], components: [approveButtons] });
  return int.editReply({ content: "Your application has been submitted! Please wait for the moderators to handle your request.", components: [], embeds: [] });
}

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonApproveStreamer(int) {
  const id = int.message.embeds[0]?.data.footer?.text ?? "";
  const member = int.guild.members.cache.get(id);

  if (!member) return int.reply({ content: "Sorry, I couldn't find that user!", flags: ["Ephemeral"] });
  if (!member.roles.cache.has(u.sf.roles.moderation.trusted)) return int.reply({ content: `${member} needs the Trusted role first!` });

  await int.deferUpdate();

  const content = await c.assignRole(int, member, u.sf.roles.streaming.approved);
  await member.send(approvalText).catch(() => c.blocked(member));

  int.editReply({ content, components: [] });
}

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonDenyStreamer(int) {
  const id = int.message.embeds[0]?.data.footer?.text ?? "";
  const member = int.guild.members.cache.get(id);

  if (!member) return int.reply({ content: "Sorry, I couldn't find that user!", flags: ["Ephemeral"] });

  await int.deferUpdate();

  await member.send(`Hey ${member.displayName}, unfortunately your application to become an approved streamer has been denied. This was likely due to the type of content being streamed, but please reach out to someone on the Public Affairs team if you have any questions.`).catch(u.noop);
  int.editReply({ content: `${member}'s application has been denied by ${int.member}`, components: [] });
}


Module.addInteraction({
  id: u.sf.commands.slashTwitch,
  onlyGuild: true,
  process: (int) => {
    try {
      const subcommand = int.options.getSubcommand(true);
      switch (subcommand) {
        case "extralife-team": return slashTwitchExtralifeTeam(int);
        case "live": return slashTwitchLive(int);
        case "application": return slashTwitchApplication(int);
        default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    } catch (error) {
      u.errorHandler(error, int);
    }
  }
})
.addEvent("interactionCreate", (int) => {
  if (!int.inCachedGuild()) return;
  if (int.isButton()) {
    switch (int.customId) {
      case "approveStreamer": return buttonApproveStreamer(int);
      case "denyStreamer": return buttonDenyStreamer(int);
      case "streamerAgree": return buttonStreamerAgree(int);
      case "streamerDeny": return int.update({ content: "No worries! Feel free to apply again when you're ready.", components: [], embeds: [] });
      default: return;
    }
  }
  if (int.isModalSubmit() && int.customId === "streamerIgn") return modalStreamerIgn(int);
})
// twitch sub notifications
.addEvent("guildMemberUpdate", (oldMember, newMember) => {
  const twitchSub = u.sf.roles.streaming.sub;
  const alertChannel = newMember.client.getTextChannel(u.sf.channels.team.team);

  const hexlogo = `<:hexlogo:${u.sf.emoji.hexlogo}>`;

  let content;
  let alert;
  if (oldMember.roles.cache.has(twitchSub) && !newMember.roles.cache.has(twitchSub)) {
    content = "## It looks like your Twitch subscription to LDS Gamers has expired!\n" +
    "Twitch Prime subscriptions need to be resubbed on a monthly basis. If this was unintentional, please consider resubbing at <https://www.twitch.tv/ldsgamers>. " +
    `It helps keep the website and various game servers running. Thanks for the support! ${hexlogo}`;

    alert = "'s Twitch Sub has expired!";
  } else if (!oldMember.roles.cache.has(twitchSub) && newMember.roles.cache.has(twitchSub)) {
    content = "## Thanks for becoming an LDS Gamers Twitch Subscriber!\n" +
    "People like you help keep the website and various game servers running. If you subscribed with a Twitch Prime sub, those need to be renewed monthly. " +
    `You'll get a notification if I notice it lapse. Thanks for the support! ${hexlogo}`;

    alert = " has become a Twitch Sub!";
  }
  if (content) {
    newMember.send(content).catch(() => c.blocked(newMember));
    alertChannel?.send(`**${c.userBackup(newMember)}**${alert}`);
  }
});

module.exports = Module;
