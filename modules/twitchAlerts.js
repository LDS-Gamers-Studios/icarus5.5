const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const config = require("../config/config.json");
const Twitch = require("@twurple/api");
const fs = require("fs");
const api = require("../utils/streamingApis");

const Module = new Augur.Module();

const { assets, twitchURL, extraLife: { isExtraLife } } = api;

/*********************
 * CACHED API VALUES *
 *********************/

/** @type {Discord.Collection<string, { name: string, rating?: string }>} */
const twitchGames = new u.Collection();

/** @type {Discord.Collection<string, {live: boolean, since: number, userId?: string}>} */
const twitchStatus = new u.Collection();


const bonusStreams = require("../data/streams.json");

async function checkStreamsClockwork() {
  try {
    // Get people with the approved streamers role
    const streamers = Module.client.guilds.cache.get(u.sf.ldsg)?.roles.cache.get(u.sf.roles.streaming.approved)?.members.map(member => member.id) ?? [];
    if (streamers.length === 0) return;

    // Look up their twitch IGN
    const igns = await u.db.ign.findMany(streamers, "twitch");
    const streams = bonusStreams.filter(s => s.length > 0)
      .map(s => ({ ign: s, discordId: s }))
      .concat(igns);

    processTwitch(streams);

    // Check for Extra Life
    const now = new Date();
    if (!isExtraLife() || now.getHours() % 2 !== 1 || now.getMinutes() > 5) return;

    const embeds = await extraLifeEmbeds();
    for (const embed of embeds) {
      await Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
    }

  } catch (e) {
    u.errorHandler(e, "Stream Check");
  }
}


/**********************
 * EXTRA LIFE HELPERS *
 **********************/

/** @param {import("../utils/extralifeTypes").Team | null} [team] */
async function fetchExtraLifeStreams(team) {
  /** @type {Twitch.HelixStream[]} */
  const defaultValue = [];

  try {
    if (!team) team = await fetchExtraLifeTeam();
    if (!team) return defaultValue;

    const users = team.participants.filter(m => m.links.stream)
      .map(p => p.links.stream?.replace("https://player.twitch.tv/?channel=", "") ?? "")
      .filter(channel => !(channel.includes(" ") || channel.includes("/")));

    if (users.length === 0) return defaultValue;
    return api.twitch.streams.getStreamsByUserNames(users).catch(() => defaultValue);
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Streams");
    return defaultValue;
  }
}

async function extraLifeEmbeds() {
  try {
    const streams = await fetchExtraLifeStreams();
    if (!streams || streams.length === 0) return [];

    const embed = u.embed()
      .setTitle("Live from the Extra Life Team!")
      .setImage(assets.el.logo)
      .setColor(assets.colors.elGreen);

    const channels = streams.sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)).map(s => {
      const game = twitchGames.get(s.gameId)?.name;
      return `**${s.userDisplayName} ${game ? `playing ${game}` : ""}**\n[${u.escapeText(s.title)}](${twitchURL(s.userDisplayName)}\n`;
    });

    return u.pagedEmbedsDescription(embed, channels);
  } catch (error) {
    u.errorHandler(error, "Extra Life Embed Fetch");
    return [];
  }
}


async function fetchExtraLifeTeam() {
  try {
    const team = await api.extraLife.getTeam(Module.client);
    if (!team) return null;

    return team;
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Team");
    return null;
  }
}


/************************
 * TWITCH NOTIFICATIONS *
 ************************/

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
  if (isExtraLife()) roles.push(u.sf.roles.streaming.elteam);

  return member.roles.cache.hasAny(...roles);
}

/** @param {{ign: string, discordId: string}[]} igns */
async function processTwitch(igns) {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) return;

    const liveRole = u.sf.roles.streaming.live;
    const notificationChannel = ldsg.client.getTextChannel(u.sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const users = streamers.map(s => s.ign);

      const streams = await api.twitch.streams.getStreamsByUserNames(users)
        .catch(api.twitchErrorHandler);

      if (!streams) continue;

      const sinceThreshold = Date.now() - 30 * 60_000;

      // Handle Live
      for (const stream of streams) {
        const status = twitchStatus.get(stream.userDisplayName.toLowerCase());

        // If they were streaming recently (within half an hour), don't post notifications
        if (status && (status.live || status.since > sinceThreshold)) continue;

        const game = await api.fetchGameRating(stream.gameName, twitchGames);

        // filter out bad games
        if (game?.rating === "M - Mature 17+") continue;

        const url = twitchURL(stream.userDisplayName);

        // set activity and change bot status if LDSG is live
        let content;
        let allowMentions = false;
        if (stream.userDisplayName.toLowerCase() === "ldsgamers") {
          Module.client.user?.setActivity({ name: stream.title, url, type: Discord.ActivityType.Streaming });
          content = `**<@&${ldsg.roles.cache.get(u.sf.roles.streaming.twitchraiders)}>, we're live!**`;
          allowMentions = true;
        }

        // apply live role if applicable
        const ign = streamers.find(streamer => streamer.ign.toLowerCase() === stream.userDisplayName.toLowerCase());
        const member = ldsg.members.cache.get(ign?.discordId ?? "");
        if (member && isPartnered(member)) member.roles.add(liveRole).catch(u.noop);

        // mark as live
        twitchStatus.set(stream.userDisplayName.toLowerCase(), { live: true, since: Date.now(), userId: member?.id });

        // generate embed
        const embed = u.embed()
          .setColor(assets.colors.twitch)
          .setThumbnail(stream.getThumbnailUrl(480, 270))
          .setAuthor({ name: `${stream.userDisplayName} ${game ? `is playing ${game.name}` : ""}` })
          .setTitle(`🔴 ${stream.title}`)
          .setDescription(`${member || stream.userDisplayName} went live on Twitch!`)
          .setURL(url);

        // check for extralife (has extralife role and extra life in title)
        if (isExtraLife() && (member ? member?.roles.cache.has(u.sf.roles.streaming.elteam) : true) && stream.title.toLowerCase().match(/extra ?life/)) {
          if (content) content = `**<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>** ${content}`;
          else content = `<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>, **${member?.displayName ?? stream.userDisplayName}** is live for Extra Life!`;
          allowMentions = true;
          embed.setColor(assets.colors.elGreen);
        }

        // send it!
        notificationChannel?.send({ content, embeds: [embed], allowedMentions: allowMentions ? { parse: ["roles"] } : undefined }).catch(u.noop);
      }

      // Handle Offline
      const offline = streamers.filter(streamer => !streams.find(stream => stream.userDisplayName.toLowerCase() === streamer.ign.toLowerCase()));

      for (const channel of offline) {
        const ign = channel.ign.toLowerCase();
        const status = twitchStatus.get(ign);

        // remove if they're past the threshold
        if (status && status.live && status.since > sinceThreshold) {
          twitchStatus.delete(ign);
          continue;
        }

        // don't bother continuing if they're already marked live
        if (!status?.live) continue;

        if (channel.ign.toLowerCase() === "ldsgamers") Module.client.user?.setActivity({ name: "Tiddlywinks", type: Discord.ActivityType.Playing });

        // remove the live role
        const member = ldsg.members.cache.get(channel.discordId);
        if (member?.roles.cache.has(liveRole)) {
          member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
        }

        twitchStatus.set(ign, {
          live: false,
          since: Date.now(),
          userId: member?.id
        });

      }
    }
  } catch (e) {
    u.errorHandler(e, "Process Twitch");
  }
}

function writeCache() {
  const cutoff = u.moment().add(1, "hour").valueOf();
  fs.writeFileSync("./data/streamcache.txt", `${cutoff}\n${twitchStatus.map((s, n) => `${s.userId || ""};${s.live};${s.since};${n}`).join("\n")}`);
}

Module.addCommand({
  name: "checkstreams",
  permissions: () => config.devMode,
  process: checkStreamsClockwork
})
.setClockwork(() => {
  return setInterval(checkStreamsClockwork, 5 * 60_000);
})
.setInit(async (data) => {
  api.loadDonationCache();

  if (data) {
    for (const [key, status] of data.twitchStatus) {
      twitchStatus.set(key, status);
    }

    for (const [key, game] of data.twitchGames) {
      twitchGames.set(key, game);
    }
  } else {
    // read from the cache if it exists
    if (fs.existsSync("./data/streamcache.txt")) {
      const cache = fs.readFileSync("./data/streamcache.txt", "utf-8").split("\n");
      const cutoffTime = cache.shift();

      // data after the cutoff is too old and shouldn't be used.
      if (parseInt(cutoffTime ?? "") > Date.now()) {
        for (const row of cache) {
          const [userId, live, since, ...name] = row.split(";");
          twitchStatus.set(name.join(";"), { userId, live: live === "true", since: parseInt(since) });
        }
      }

      // delete the cache
      fs.unlinkSync("./data/streamcache.txt");
    }

    // reset live role on restart
    const members = Module.client.guilds.cache.get(u.sf.ldsg)?.roles.cache.get(u.sf.roles.streaming.live)?.members ?? new u.Collection();
    for (const [id, member] of members) {
      if (!twitchStatus.find(s => s.userId === id)) await member.roles.remove(u.sf.roles.streaming.live);
    }
  }

  if (config.devMode) checkStreamsClockwork();
})
.setUnload(() => {
  delete require.cache[require.resolve("../data/streams.json")];
  delete require.cache[require.resolve("../utils/streamingApis.js")];
  return { twitchStatus, twitchGames };
})
.setShared({ writeCache, twitchGames, fetchExtraLifeStreams });

/**
 * @typedef {{ writeCache: writeCache, twitchGames: twitchGames, fetchExtraLifeStreams: fetchExtraLifeStreams }} AlertsShared
 */

module.exports = Module;