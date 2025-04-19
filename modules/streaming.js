// @ts-check

const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const NoRepeat = require("no-repeat");
const fs = require("fs");
const config = require("../config/config.json");
const Twitch = require("@twurple/api");
const TwitchAuth = require("@twurple/auth").AppTokenAuthProvider;
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const axios = require("axios");
const teamId = config.twitch.elTeam;
const extralifeApi = require("../utils/extralife");

const Module = new Augur.Module();

const colors = { elGreen: 0x7fd836, elBlue: 0x26c2eb, twitch: 0x6441A4 };

function extraLife() {
  return config.devMode || [9, 10].includes(new Date().getMonth());
}

/** @param {string} name */
function twitchURL(name) {
  return `https://twitch.tv/${encodeURIComponent(name)}`;
}


/** @type {Map<string, Twitch.HelixGame & { rating?: string }>} */
const twitchGames = new Map();

/** @type {Map<string, {live: boolean, since: number}>} */
const twitchStatus = new Map();

const twitch = new Twitch.ApiClient({ authProvider: new TwitchAuth(config.twitch.clientId, config.twitch.clientSecret) });
const bonusStreams = require("../data/streams.json");

const approvalText = "## Congratulations!\n" +
  `You've been added to the Approved Streamers list in LDSG! This allows going live notifications to show up in <#${u.sf.channels.general}>, and grants access to stream to voice channels.\n` +
  "This has been done automatically, but in order to show notifications in #general, please double check that your correct Twitch name is saved in the database with `/ign view twitch`. If the link doesn't work, try `/ign set twitch YourTwitchUsername`.\n\n" +
  "While streaming, please remember the [Streaming Guidelines](<https://goo.gl/Pm3mwS>) and [LDSG Code of Conduct](<http://ldsgamers.com/code-of-conduct>).\n" +
  "-# LDSG may make changes to the Approved Streamers list from time to time at its discretion.";

const notEL = "Extra Life isn't quite ready yet! Try again in November.";

/** @param {string} gameId */
async function gameInfo(gameId) {
  // use cache if possible
  const got = twitchGames.get(gameId);
  if (got) return got;

  const game = await twitch.games.getGameById(gameId).catch(u.noop);
  if (game && config.api.thegamesdb) {
    twitchGames.set(game.id, game);

    /** @type {{ game_title: string, rating: string }[] | undefined} */
    // @ts-ignore
    const apiGame = await axios(`https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${config.api.thegamesdb}&name=${encodeURIComponent(game.name)}&fields=rating`)
      .then(/** @param {any} res */ (res) => res.data?.games);

    const ratings = apiGame?.filter(g => g.game_title.toLowerCase() === game.name.toLowerCase() && g.rating !== "Not Rated");
    const withRating = Object.assign(game, { rating: ratings?.[0]?.rating });

    twitchGames.set(game.id, withRating);
    return withRating;
  }
}

async function checkStreams() {
  try {
    // Approved Streamers
    const streamers = Module.client.guilds.cache.get(u.sf.ldsg)?.roles.cache.get(u.sf.roles.streaming.approved)?.members.map(member => member.id) ?? [];
    if (streamers.length === 0) return;

    const igns = await u.db.ign.findMany(streamers, "twitch");
    processTwitch(bonusStreams.map(s => ({ ign: s, discordId: s })).concat(igns));

    // Check for Extra Life
    if (extraLife() && (new Date().getMinutes() < 5)) {
      const embeds = await extraLifeEmbeds();
      for (const embed of embeds) {
        await Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    u.errorHandler(e, "Stream Check");
  }
}

async function extraLifeEmbeds() {
  try {
    const streams = await fetchExtraLifeStreams();
    if (!streams || streams.length === 0) return [];

    const embed = u.embed()
      .setTitle("Live from the Extra Life Team!")
      .setColor(colors.elGreen);

    const channels = streams.sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)).map(s => {
      const game = twitchGames.get(s.gameId)?.name;
      return `**${s.userDisplayName} ${game ? ` playing ${game}` : ""}**\n[${u.escapeText(s.title)}](${twitchURL(s.userDisplayName)}`;
    });

    const embeds = u.pagedEmbedsDescription(embed, channels);
    return embeds;
  } catch (error) {
    u.errorHandler(error, "Extra Life Embed Fetch");
    return [];
  }
}

/** @param {extralifeApi.Team | null} [team] */
async function fetchExtraLifeStreams(team) {
  /** @type {Twitch.HelixStream[]} */
  const defaultValue = [];

  try {
    if (!team) team = await fetchExtraLifeTeam().catch(() => null);
    if (!team) return defaultValue;

    const users = team.participants.filter(m => m.links.stream)
      .map(p => p.links.stream?.replace("https://player.twitch.tv/?channel=", "") ?? "")
      .filter(channel => !(channel.includes(" ") || channel.includes("/")));

    if (users.length === 0) return defaultValue;
    return twitch.streams.getStreamsByUserNames(users).catch(() => defaultValue);
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Streams");
    return defaultValue;
  }
}

/** @type {Set<string>} */
const donors = new Set();
/** @type {Set<string>} */
const donationIDs = new Set();

const almosts = new NoRepeat([
  "almost",
  "like",
  "basically equivalent to",
  "essentially",
  "the same as"
]);

/** @param {number} num */
const rnd = num => Math.round((num + Number.EPSILON) * 100) / 100;

/** @type {NoRepeat<(num: number) => string>} */
const prices = new NoRepeat([
  (num) => `${rnd(num * 3.84615384)} buttermelons`,
  (num) => `${rnd(num * 15.5)}oz of beans`,
  (num) => `${rnd(num / 4.99)} handicorn sets`,
  (num) => `${rnd(num * 12 / 2.97)} ice cream sandwiches`,
  (num) => `${rnd(num / 29.99)} copies of Minecraft`,
  (num) => `${rnd(num / 100)} <:gb:493084576470663180>`,
  (num) => `${rnd(num / 5)} copies of Shrek`,
  (num) => `${rnd(num / 27.47)} ink cartridges`
]);

async function fetchExtraLifeTeam() {
  try {
    const team = await extralifeApi.getTeam().catch(() => null);
    if (!team) return null;

    // Check donors while we're at it.
    const donations = await extralifeApi.getTeamDonations().catch(() => null);
    if (!donations) return team;

    let update = false;

    for (const donation of donations) {
      if (donationIDs.has(donation.donationID)) continue;

      donationIDs.add(donation.donationID);
      update = true;

      if (donation.displayName && !donors.has(donation.displayName)) {
        donors.add(donation.displayName);
        const embed = u.embed().setColor(colors.elBlue)
          .setTitle("New Extra Life Donor(s)")
          .setThumbnail(donation.avatarImageURL)
          .setDescription(donation.displayName)
          .setTimestamp(new Date(donation.createdDateUTC));
        Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });
      }

      const embed = u.embed()
        .setColor(colors.elBlue)
        .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
        .setDescription(donation.message || "[ No Message ]")
        .addFields([
          { name: "Amount", value: `$${donation.amount}`, inline: true },
          { name: "Recipient", value: donation.recipientName, inline: true },
          { name: "Incentive", value: donation.incentiveID || "[ None ]", inline: true }
        ])
        .setTimestamp(new Date(donation.createdDateUTC));
      Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });

      const publicEmbed = u.embed().setColor(0x7fd836)
        .setTitle("New Extra Life Donation")
        .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${teamId}`)
        .setThumbnail("https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png")
        .setTimestamp(new Date(donation.createdDateUTC))
        .setDescription(`Someone just donated **$${donation.amount}** to our Extra Life team! That's ${almosts.getRandom()} **${prices.getRandom}!**\n(btw, that means we're at **$${team.sumDonations}**, which is **${team.sumDonations / team.fundraisingGoal * 100}%** of the way to our goal!)`);

      Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [publicEmbed] });
    }

    if (update) {
      fs.writeFileSync("./data/extraLifeDonors.json", JSON.stringify({
        donors: [...donors],
        donationIDs: [...donationIDs]
      }));
    }

    return team;
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Team");
    return null;
  }
}

/** @param {Discord.GuildMember} member */
function isPartnered(member) {
  // icarus is always partnered
  if (member.id === member.client.user.id) return true;
  const roles = [
    u.sf.roles.sponsors.onyx,
    u.sf.roles.sponsors.pro,
    u.sf.roles.sponsors.legendary,
    u.sf.roles.team.team
  ];

  // check for EL Team
  if (extraLife()) roles.push(u.sf.roles.streaming.elteam);

  return member.roles.cache.hasAny(...roles);
}

/** @param {{ign: string, discordId: string}[]} igns */
async function processTwitch(igns) {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) return;

    const liveRole = ldsg.roles.cache.get(u.sf.roles.streaming.live);
    const notificationChannel = ldsg.client.getTextChannel(u.sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const users = streamers.map(s => s.ign);

      const streams = await twitch.streams.getStreamsByUserNames(users)
        .catch(error => { u.errorHandler(error, "Twitch getStreamsByUserNames()"); });

      if (!streams) return;

      // Handle Live
      for (const stream of streams) {
        const status = twitchStatus.get(stream.userDisplayName.toLowerCase());
        if (!status || ((status.live === false) && ((Date.now() - status.since) >= (30 * 60 * 1000)))) {
          const game = await gameInfo(stream.gameId);

          // filter out bad games
          if (game?.rating === "M - Mature 17+") return;

          const url = twitchURL(stream.userDisplayName);

          // set activity and change status
          let content;
          if (stream.userDisplayName.toLowerCase() === "ldsgamers") {
            Module.client.user?.setActivity({ name: stream.title, url, type: Discord.ActivityType.Streaming });
            content = `**<@&${ldsg.roles.cache.get(u.sf.roles.streaming.twitchraiders)}>, we're live!**`;
          }

          // mark as live
          twitchStatus.set(stream.userDisplayName.toLowerCase(), { live: true, since: Date.now() });

          // apply live role if applicable
          const ign = streamers.find(streamer => streamer.ign.toLowerCase() === stream.userDisplayName.toLowerCase());
          const member = ldsg.members.cache.get(ign?.discordId ?? "");
          if (member && isPartnered(member)) member.roles.add(u.sf.roles.streaming.live).catch(u.noop);

          // generate embed
          const embed = u.embed()
            .setColor(colors.twitch)
            .setThumbnail(stream.getThumbnailUrl(480, 270))
            .setAuthor({ name: `${stream.userDisplayName} ${game ? `playing ${game.name}` : ""}` })
            .setTitle(`🔴 ${stream.title}`)
            .setDescription(`${member || stream.userDisplayName} went live on Twitch!`)
            .setURL(url);

          // check for extralife
          if (extraLife() && member?.roles.cache.has(u.sf.roles.streaming.elteam) && stream.title.toLowerCase().match(/extra ?life/)) {
            if (content) content = `**<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>** ${content}`;
            else content = `<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>, **${member.displayName}** is live for Extra Life!`;
            embed.setColor(colors.elGreen);
          }

          // send it!
          notificationChannel?.send({ content, embeds: [embed], allowedMentions: { parse: ["roles"] } }).catch(u.noop);
        }
      }

      // Handle Offline
      const offline = streamers.filter(streamer => !streams.find(stream => stream.userDisplayName.toLowerCase() === streamer.ign.toLowerCase()));

      for (const channel of offline) {
        const status = twitchStatus.get(channel.ign.toLowerCase());
        if (!status?.live) continue;

        if (channel.ign.toLowerCase() === "ldsgamers") Module.client.user?.setActivity({ name: "Tiddlywinks", type: Discord.ActivityType.Playing });

        const member = ldsg.members.cache.get(channel.discordId);
        if (member && liveRole?.members.has(member.id)) {
          member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
        }

        twitchStatus.set(channel.ign.toLowerCase(), {
          live: false,
          since: Date.now()
        });
      }
    }
  } catch (e) {
    u.errorHandler(e, "Process Twitch");
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeTeam(int) {
  if (!extraLife()) return int.reply({ content: notEL, flags: ["Ephemeral"] });
  await int.deferReply();

  const team = await fetchExtraLifeTeam();
  if (!team) return int.editReply("Sorry, looks like the Extra Life API is down! Try later!").then(u.clean);

  const streams = await fetchExtraLifeStreams(team);
  const members = team.participants.map(p => {
    const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "");
    const stream = streams.find(s => username && s.userDisplayName === username);
    return { ...p, username, isLive: Boolean(stream), stream };
  });

  // sort by live, then donations, then name
  members.sort((a, b) => {
    if (a.isLive !== b.isLive) return (a.isLive === b.isLive) ? 0 : a.isLive ? -1 : 1;
    if (a.sumDonations !== b.sumDonations) return b.sumDonations - a.sumDonations;
    return a.displayName.localeCompare(b.displayName);
  });

  const total = members.reduce((p, cur) => p + cur.sumDonations, 0);

  const teamStrings = members.map(m => {
    const percent = Math.round(100 * m.sumDonations / m.fundraisingGoal);
    let str = `**${m.displayName}**\n` +
      `$${m.sumDonations} / $${m.fundraisingGoal} (${percent}%)\n` +
      `**[[Donate]](${m.links.donate})**`;

    if (m.isLive) str += `\n### STREAM IS NOW LIVE\n[${m.stream?.title ?? "Watch Here"}](https://twitch.tv/${m.username})`;
    return str;
  });

  const nextMilestone = team.milestones.sort((a, b) => a.fundraisingGoal - b.fundraisingGoal)
    .find(m => m.fundraisingGoal > team.sumDonations);

  const wallOfText = `LDSG is raising money for Extra Life! We are currently at **$${total}** of our team's **$${team.fundraisingGoal}** goal for ${new Date().getFullYear()}. **That's ${Math.round(100 * total / team.fundraisingGoal)}% of the way there!**\n\nYou can help by donating to one of the Extra Life Team members below.`;

  const embed = u.embed().setTitle("LDSG Extra Life Team")
    .setThumbnail("https://assets.donordrive.com/extralife/images/fbLogo.jpg?v=202009241356")
    .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${teamId}#teamTabs`)
    .setDescription(`${wallOfText}\n\n${teamStrings.join("\n\n")}\n\n${nextMilestone ? `# Next Milestone:\n$${nextMilestone.fundraisingGoal} - ${nextMilestone.description}` : ""}`);

  return int.editReply({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeStreaming(int) {
  if (!extraLife()) return int.reply({ content: notEL, flags: ["Ephemeral"] });
  await int.deferReply();

  const embeds = await extraLifeEmbeds();
  if (embeds.length > 0) return u.manyReplies(int, embeds.map(e => ({ embeds: [e] })));

  int.editReply("Doesn't look like anyone's live right now!").then(u.clean);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchLive(int) {
  const ephemeral = u.ephemeralChannel(int, u.sf.channels.botSpam);
  await int.deferReply({ flags: ephemeral });

  const approved = int.guild.roles.cache.get(u.sf.roles.streaming.approved);
  const igns = await u.db.ign.findMany([...(approved?.members.keys() ?? [])], "twitch")
    .then(i => i.map(ign => ign.ign));

  /** @type {Promise<Twitch.HelixStream[]>[]} */
  const streamFetch = [];
  for (let i = 0; i < igns.length; i += 100) {
    const userName = igns.slice(i, i + 100);
    streamFetch.push(twitch.streams.getStreams({ userName }).catch(u.noop).then(s => s?.data ?? []));
  }

  const res = await Promise.all(streamFetch);

  const embed = u.embed()
    .setTitle(`Currently Streaming in ${int.guild.name}`)
    .setColor("#6441A4")
    .setTimestamp();

  const chanPromises = res.flat().map(stream => {
    return gameInfo(stream.gameId).then(game => {
      return {
        name: stream.userDisplayName,
        game,
        title: stream.title,
        url: twitchURL(stream.userDisplayName)
      };
    });
  });

  const channels = await Promise.all(chanPromises).then(ch => ch.sort((a, b) => a.name.localeCompare(b.name)));
  const lines = channels.map(ch => `**${ch.name} is playing ${ch.game}**\n[${ch.title}](${ch.url})`);

  const embeds = u.pagedEmbedsDescription(embed, lines);
  return u.manyReplies(int, embeds.map(e => ({ embeds: [e] })), Boolean(ephemeral));
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTwitchApplication(int) {
  if (int.member.roles.cache.has(u.sf.roles.streaming.approved)) return int.reply({ content: "You're already approved!", flags: ["Ephemeral"] });

  const agreement = u.MessageActionRow().addComponents([
    new u.Button({ customId: "streamerAgree", emoji: "✅", label: "Agree", style: Discord.ButtonStyle.Success }),
    new u.Button({ customId: "streamerDeny", emoji: "❌", label: "Deny", style: Discord.ButtonStyle.Secondary }),
  ]);

  const applicationEmbed = u.embed().setTitle("Approved Streamer Application (Part 1)")
    .setDescription(`By clicking \`Agree\`, you agree to follow the [Streaming Guidelines](https://goo.gl/Pm3mwS) and the [Code of Conduct](https://ldsg.io/code). Are you willing to follow these standards?`);

  return int.reply({ embeds: [applicationEmbed], components: [agreement], flags: ["Ephemeral"] });
}

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonStreamerAgree(int) {
  const name = await u.db.ign.findOne(int.member.id, "twitch").then(i => i?.ign);
  // make modal
  const ignModal = new u.Modal().addComponents(
    u.ModalActionRow().addComponents(
      new u.TextInput()
        .setLabel("Twitch Username")
        .setRequired(true)
        .setPlaceholder("https://twitch.tv/___this_part___")
        .setValue(name || "")
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
  ).setCustomId("streamerIgn")
  .setTitle("Approved Streamer Application (Part 2)");

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

  await u.db.ign.save(int.member.id, "twitch", name);

  // generate and send the request
  const embed = u.embed().setTitle("Approved Streamer Request")
    .setDescription(`${c.userBackup(int.member)} has requested to become an approved streamer.`)
    .setColor(c.colors.info)
    .addFields(
      { name: "Twitch", value: `[${name}](https://twitch.tv/${name})` },
      { name: "Usual Games", value: games }
    )
    .setFooter({ text: int.member.id });

  await int.client.getTextChannel(u.sf.channels.team.publicAffairs)?.send({ embeds: [embed], components: [approveButtons] });
  return int.editReply({ content: "Your application has been submitted! Please wait for the moderators to handle your request.", components: [], embeds: [] });
}

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonApproveStreamer(int) {
  const id = int.message.embeds[0]?.data.footer?.text;
  const member = int.guild.members.cache.get(id ?? "");

  if (!member) return int.reply({ content: "Sorry, I couldn't find that user!", flags: ["Ephemeral"] });
  if (!member.roles.cache.has(u.sf.roles.moderation.trusted)) return int.reply({ content: `${member} needs the Trusted role first!` });

  await int.deferUpdate();

  const content = await c.assignRole(int, member, u.sf.roles.streaming.approved);
  await member.send(approvalText).catch(() => c.blocked(member));

  int.editReply({ content, components: [] });
}

/** @param {Augur.GuildInteraction<"Button">} int*/
async function buttonDenyStreamer(int) {
  const id = int.message.embeds[0]?.data.footer?.text;
  const member = int.guild.members.cache.get(id ?? "");

  if (!member) return int.reply({ content: "Sorry, I couldn't find that user!", flags: ["Ephemeral"] });

  await int.deferUpdate();

  await member.send(`Hey ${member.displayName}, unfortunately your application to become an approved streamer has been denied. This was likely due to the type of content being streamed, but please reach out to someone on the Public Affairs team if you have any questions.`).catch(u.noop);
  int.editReply({ content: `${member}'s application has been denied`, components: [] });
}


Module.addInteraction({
  id: u.sf.commands.slashTwitch,
  onlyGuild: true,
  process: (int) => {
    try {
      const subcommand = int.options.getSubcommand(true);
      switch (subcommand) {
        case "team": return slashTwitchExtralifeTeam(int);
        case "streaming": return slashTwitchExtralifeStreaming(int);
        case "live": return slashTwitchLive(int);
        case "application": return slashTwitchApplication(int);
        default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    } catch (error) {
      u.errorHandler(error, int);
    }
  }
})
.addInteraction({
  id: "streamerIgn",
  type: "Modal",
  onlyGuild: true,
  process: modalStreamerIgn
})
.addInteraction({
  id: "streamerAgree",
  type: "Button",
  onlyGuild: true,
  process: buttonStreamerAgree
})
.addInteraction({
  id: "streamerDeny",
  type: "Button",
  onlyGuild: true,
  process: (int) => int.update({ content: "No worries! Feel free to apply again when you're ready.", components: [], embeds: [] })
})
.addInteraction({
  id: "approveStreamer",
  type: "Button",
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["team", "mod"]),
  process: buttonApproveStreamer
})
.addInteraction({
  id: "denyStreamer",
  type: "Button", onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["team", "mod"]),
  process: buttonDenyStreamer
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
    "Twitch Prime subscriptions need to be resubbed on a monthly basis. If this was unintentional, please consider resubbing at <https://www.twitch.tv/ldsgamers>." +
    `It helps keep the website and various game servers running. Thanks for the support! ${hexlogo}`;

    alert = "'s Twitch Sub has expired!";
  } else if (!oldMember.roles.cache.has(twitchSub) && newMember.roles.cache.has(twitchSub)) {
    content = "## Thanks for becoming an LDS Gamers Twitch Subscriber!\n" +
    "People like you help keep the website and various game servers running. If you subscribed with a Twitch Prime sub, those need to be renewed monthly." +
    `You'll get a notification if I notice it lapse. Thanks for the support! ${hexlogo}`;

    alert = " has become a Twitch Sub!";
  }
  if (content) {
    newMember.send(content).catch(() => c.blocked(newMember));
    alertChannel?.send(`**${c.userBackup(newMember)}**${alert}`);
  }
})
.setInit((data) => {
  if (data) {
    for (const [key, status] of data.twitchStatus) {
      twitchStatus.set(key, status);
    }
  }
})
.setClockwork(() => {
  const interval = 5 * 60_000;
  return setInterval(checkStreams, interval);
});

module.exports = Module;
