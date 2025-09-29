// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const Twitch = require("@twurple/api");
const fs = require("fs");

const u = require("../utils/utils");
const c = require("../utils/modCommon");
const config = require("../config/config.json");
const api = require("../utils/streamingApis");


const Module = new Augur.Module();

const { assets: { colors }, twitchURL, extraLife: { isExtraLife } } = api;
const twitchEnabled = config.twitch.enabled && config.twitch.clientId && config.twitch.clientSecret;

const approvalText = "## Congratulations!\n" +
  `You've been added to the Approved Streamers list in LDSG! This allows going live notifications to show up in <#${u.sf.channels.general}>, and grants access to stream to voice channels.\n` +
  "This has been done as part of the application process, but please double check that your correct Twitch username is saved by doing `/ign view twitch`. If the IGN's URL doesn't work, try `/ign set twitch YourTwitchUsername`.\n\n" +
  "While streaming, please remember the [Streaming Guidelines](<https://goo.gl/Pm3mwS>) and [LDSG Code of Conduct](<http://ldsgamers.com/code-of-conduct>).\n" +
  "-# LDSG may make changes to the Approved Streamers list from time to time at its discretion.";

const STREAM_CACHE_FILE = "./data/streamcache.json";

/******************
 * SLASH COMMANDS *
 ******************/

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchLive(int) {
  const ephemeral = u.ephemeralChannel(int, u.sf.channels.botSpam);
  await int.deferReply({ flags: ephemeral });

  const streams = api.twitchStatus.filter(s => s.live);
  if (streams.size === 0) return int.editReply("No one is streaming right now!").then(u.clean);

  const embed = u.embed()
    .setTitle(`Currently Streaming in ${int.guild.name}`)
    .setColor(colors.twitch);

  const channels = streams.map((status, username) => ({
    name: status.stream?.userDisplayName || username,
    game: status.stream?.gameName || "something",
    title: status.stream?.title || "Watch Here",
    url: twitchURL(status.stream?.userDisplayName || username),
  }));

  channels.sort((a, b) => a.name.localeCompare(b.name));

  const lines = channels.map(ch => `**${ch.name} is playing ${ch.game}**\n[${ch.title}](${ch.url})\n`);
  const embeds = u.pagedEmbedsDescription(embed, lines);

  return u.manyReplies(int, embeds.map(e => ({ embeds: [e] })), Boolean(ephemeral));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTwitchApplication(int) {
  if (int.member.roles.cache.has(u.sf.roles.streaming.approved)) return int.reply({ content: "You're already an approved streamer!", flags: ["Ephemeral"] });
  if (!int.member.roles.cache.has(u.sf.roles.moderation.trusted)) return int.reply({ content: "You need the Trusted role first!", flags: ["Ephemeral"] });

  const agreement = u.MessageActionRow().addComponents([
    new u.Button({ customId: "streamerAgree", emoji: "✅", label: "Agree", style: Discord.ButtonStyle.Success }),
    new u.Button({ customId: "streamerDeny", emoji: "❌", label: "Deny", style: Discord.ButtonStyle.Secondary }),
  ]);

  const applicationEmbed = u.embed().setTitle("Approved Streamer Application (Part 1 of 2)")
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
    .setTitle("Approved Streamer Application (Part 2 of 2)")
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
  const name = int.fields.getTextInputValue("username").toLowerCase().trim();
  const games = int.fields.getTextInputValue("games");

  if (name.includes("twitch.tv/")) return int.editReply("It looks like you've included a URL in your Twitch username. Please enter only your Twitch username (for example, 'ldsgamers'), not the full URL. Hit `Agree` to try again.");
  await u.db.ign.save(int.member.id, "twitch", name);

  // generate and send the request
  const embed = u.embed({ author: int.member }).setTitle("New Approved Streamer Application")
    .setDescription(`${c.userBackup(int.member)} has requested to become an approved streamer. It's recommended that you watch a stream or two of theirs before approving them.`)
    .setColor(c.colors.info)
    .setFooter({ text: int.member.id })
    .addFields(
      { name: "Twitch", value: `[${name}](https://twitch.tv/${name})` },
      { name: "Usual Games", value: games }
    );

  await int.client.getTextChannel(u.sf.channels.team.publicAffairs)?.send({ embeds: [embed], components: [approveButtons] });
  return int.editReply({ content: "Your application has been submitted! Please wait for the Public Affairs Team to handle your request.", components: [], embeds: [] });
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

/***********************
 * TWITCH ALERT SYSTEM *
 ***********************/
const sinceThreshold = () => Date.now() - 30 * 60_000;

/**
 * @param {Twitch.HelixStream[]} streams
 * @param {{ign: string, discordId: string}[]} streamers
 * @param {Discord.Guild} ldsg
*/
async function handleOnline(streams, streamers, ldsg) {
  /** @type {Discord.MessageCreateOptions[]} */
  const messages = [];

  for (const stream of streams) {
    const status = api.twitchStatus.get(stream.userDisplayName.toLowerCase());

    // If they were streaming recently (within half an hour), don't post notifications
    if (status && (status.live || status.sinceOffline > sinceThreshold())) {
      status.stream = stream;
      continue;
    }

    // filter out bad games
    if (await api.isRatedM(stream.gameName)) continue;

    const url = twitchURL(stream.userDisplayName);

    // set activity and change bot status if LDSG is live
    let content;
    let allowMentions = false;
    if (stream.userDisplayName.toLowerCase() === "ldsgamers") {
      Module.client.user?.setActivity({ name: stream.title, url, type: Discord.ActivityType.Streaming });
      content = `**<@&${u.sf.roles.streaming.twitchraiders}>, we're live!**`;
      allowMentions = true;
    }

    // apply live role if applicable
    const ign = streamers.find(streamer => streamer.ign.toLowerCase() === stream.userDisplayName.toLowerCase());
    const member = ldsg.members.cache.get(ign?.discordId ?? "");
    if (member && api.isPartnered(member)) {
      member.roles.add(u.sf.roles.streaming.live).catch(u.noop);
    }

    // mark as live
    api.twitchStatus.set(stream.userDisplayName.toLowerCase(), {
      live: true,
      sinceOffline: Date.now(),
      userId: member?.id,
      stream: { userDisplayName: stream.userDisplayName, gameName: stream.gameName, title: stream.title, gameId: stream.gameId }
    });

    // generate embed
    const embed = u.embed()
      .setColor(colors.twitch)
      .setThumbnail(stream.getThumbnailUrl(480, 270) + `?t=${Date.now()}`)
      .setAuthor({ name: `${stream.userDisplayName} ${stream.gameName ? `is playing ${stream.gameName}` : ""}` })
      .setTitle(`🔴 ${stream.title}`)
      .setTimestamp(stream.startDate)
      .setURL(url);

    // check for extralife (has extralife role and extra life in title)
    if (isExtraLife() && (member ? member?.roles.cache.has(u.sf.roles.streaming.elteam) : true) && stream.title.match(/extra[ -]?life/i)) {
      if (content) content = `**<@&${u.sf.roles.streaming.elraiders}>** ${content}`;
      else content = `<@&${u.sf.roles.streaming.elraiders}>, **${member?.displayName ?? stream.userDisplayName}** is live for Extra Life!`;

      allowMentions = true;
      embed.setColor(colors.elGreen);
    }

    // send it!
    messages.push({ content, embeds: [embed], allowedMentions: allowMentions ? { parse: ["roles"] } : undefined });
  }

  return messages;
}

/**
 * @param {{ign: string, discordId: string}[]} streamers
 * @param {Discord.Guild} ldsg
 */
async function handleOffline(streamers, ldsg) {
  for (const channel of streamers) {
    const ign = channel.ign.toLowerCase();
    const status = api.twitchStatus.get(ign);

    // remove if they're past the threshold
    if (status && !status.live && status.sinceOffline <= sinceThreshold()) {
      api.twitchStatus.delete(ign);
      continue;
    }

    // don't bother continuing if they're already marked as offline
    if (!status?.live) continue;

    if (channel.ign.toLowerCase() === "ldsgamers") Module.client.user?.setActivity({ name: "Tiddlywinks", type: Discord.ActivityType.Playing });

    // remove the live role
    const member = ldsg.members.cache.get(channel.discordId);
    if (member?.roles.cache.has(u.sf.roles.streaming.live)) {
      member.roles.remove(u.sf.roles.streaming.live).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
    }

    api.twitchStatus.set(ign, {
      live: false,
      sinceOffline: Date.now(),
      userId: member?.id,
      stream: status.stream
    });
  }
}

/** @param {{ign: string, discordId: string}[]} igns */
async function processTwitch(igns) {
  try {
    if (!twitchEnabled) return;

    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("Couldn't find LDSG");

    const notificationChannel = ldsg.client.getTextChannel(u.sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const usernames = streamers.map(s => s.ign);

      const streams = await api.twitch.streams.getStreamsByUserNames(usernames)
        .catch(api.twitchErrorHandler);

      if (!streams) continue;

      const messages = await handleOnline(streams, streamers, ldsg);
      for (const message of messages) {
        await notificationChannel?.send(message).catch(u.noop);
      }

      const offline = streamers.filter(streamer => !streams.find(stream => stream.userDisplayName.toLowerCase() === streamer.ign.toLowerCase()));
      await handleOffline(offline, ldsg);
    }
  } catch (e) {
    u.errorHandler(e, "Process Twitch");
  }
}

async function checkStreamsClockwork() {
  try {
    // Get people with the approved streamers role
    const streamers = Module.client.guilds.cache.get(u.sf.ldsg)
      ?.roles.cache.get(u.sf.roles.streaming.approved)
      ?.members.map(member => member.id) ?? [];

    // Post twitch notifications
    if (streamers.length > 0) {
      const igns = await u.db.ign.findMany(streamers, "twitch");
      processTwitch(igns);
    }


    // Check for Extra Life
    if (!isExtraLife() && !config.devMode) return;

    /** @type {import("./extralife").ExtraLifeShared} */
    const shared = Module.client.moduleManager.shared.get("extralife.js");
    const embeds = await shared.alerts();

    // alerts does automatic donation/join posts. we only want to post summary embeds at the top of every other hour
    const now = new Date();
    if ((now.getMinutes() > 5 || now.getHours() % 2 === 0) && !config.devMode) return;

    for (const embed of embeds) {
      await Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
    }

  } catch (e) {
    u.errorHandler(e, "Stream Check");
  }
}

/**
 * @typedef StreamCache
 * @prop {number} cutoff
 * @prop {import("../utils/streamingApis").LiveUser[]} streams
 */

function writeCache() {
  /** @type {StreamCache} */
  const writeObj = {
    cutoff: u.moment().add(30, "minutes").valueOf(),
    streams: [...api.twitchStatus.values()]
  };

  fs.writeFileSync(STREAM_CACHE_FILE, JSON.stringify(writeObj, null, 2));
}

/****************
 *    MODULE    *
 ****************/
Module.addInteraction({
  id: u.sf.commands.slashTwitch,
  onlyGuild: true,
  process: (int) => {
    try {
      const subcommand = int.options.getSubcommand(true);
      switch (subcommand) {
        case "extralife-team": {
          /** @type {import("./extralife").ExtraLifeShared} */
          const extralife = int.client.moduleManager.shared.get("extralife.js");
          if (!extralife) throw new Error("Couldn't find Extra Life module");
          return extralife.slashTwitchExtralifeTeam(int);
        }
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
})
.addCommand({
  name: "checkstreams",
  permissions: () => config.devMode,
  process: checkStreamsClockwork
})
.setClockwork(() => {
  return setInterval(checkStreamsClockwork, 5 * 60_000);
})
.setInit(async (reset) => {
  if (reset) return;

  // read from the cache if it exists
  if (fs.existsSync(STREAM_CACHE_FILE)) {
    const cacheFile = fs.readFileSync(STREAM_CACHE_FILE, "utf-8");
    /** @type {StreamCache} */
    const cache = JSON.parse(cacheFile);

    // data after the cutoff is too old and shouldn't be used.
    if (cache.cutoff > Date.now()) {
      for (const status of cache.streams) {
        api.twitchStatus.set(status.stream.userDisplayName.toLowerCase(), status);
      }
    }

    // delete the cache
    fs.unlinkSync(STREAM_CACHE_FILE);
  }

  // reset live role on restart
  const members = Module.client.guilds.cache.get(u.sf.ldsg)
    ?.roles.cache.get(u.sf.roles.streaming.live)
    ?.members ?? new u.Collection();

  for (const [id, member] of members) {
    if (!api.twitchStatus.find(s => s.userId === id)?.live) await member.roles.remove(u.sf.roles.streaming.live);
  }

  if (config.devMode) checkStreamsClockwork();
})
.setUnload(() => {
  return true;
})
.setShared({ writeCache });

/**
 * @typedef {{ writeCache: writeCache }} StreamingShared
 */

module.exports = Module;
