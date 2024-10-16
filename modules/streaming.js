// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  fs = require("fs"),
  config = require("../config/config.json"),
  Twitch = require("@twurple/api"),
  TwitchAuth = require("@twurple/auth").AppTokenAuthProvider,
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  gamesDBApi = require("../utils/thegamesdb"),
  teamId = config.twitch.elTeam,
  ELAPI = require("../utils/extralife"),
  gamesDB = new gamesDBApi();

const Module = new Augur.Module();

const extraLife = () => config.devMode || [9, 10].includes(new Date().getMonth()),
  extralifeApi = new ELAPI.ExtraLifeAPI().set(teamId),
  twitchURL = (name) => `https://twitch.tv/${encodeURIComponent(name)}`,
  authProvider = new TwitchAuth(config.twitch.clientId, config.twitch.clientSecret),
  twitch = new Twitch.ApiClient({ authProvider }),
  twitchGames = new Map(),
  /** @type {Map<string, {live: boolean, since: number}>} */
  twitchStatus = new Map(),
  bonusStreams = require("../data/streams.json");

const approvalText = "## Congratulations!\n" +
  "You've been added to the Approved Streamers list in LDSG! This allows notifications to show up in #general and grants access to stream to voice channels.\n" +
  "In order to show notifications in #general, please make sure your correct Twitch name is saved in the database with `!addIGN twitch YourName`.\n\n" +
  "While streaming, please remember the [Streaming Guidelines](https://goo.gl/Pm3mwS) and [LDSG Code of Conduct](http://ldsgamers.com/code-of-conduct)." +
  "-# LDSG may make changes to the Approved Streamers list from time to time at its discretion.";

const notEL = "Extra Life isn't quite ready yet! Try again in November.";

async function gameInfo(gameId) {
  if (!twitchGames.has(gameId)) {
    const game = await twitch.games.getGameById(gameId).catch(u.noop);
    if (game && config.api.thegamesdb) {
      twitchGames.set(game.id, game);
      const ratings = (await gamesDB.byGameName(game.name, { fields: "rating" }))
        .games?.filter(g => g.game_title.toLowerCase() === game.name.toLowerCase() && g.rating !== "Not Rated");
      twitchGames.get(game.id).rating = ratings[0]?.rating;
    }
  }
  return twitchGames.get(gameId);
}

async function checkStreams() {
  try {
    // Approved Streamers
    const streamers = Module.client.guilds.cache.get(u.sf.ldsg)?.roles.cache.get(u.sf.roles.streaming.approved)?.members.map(member => member.id) ?? [];
    if (streamers.length === 0) return;
    const igns = await u.db.ign.find(streamers, "twitch");
    const streams = bonusStreams.map(s => ({ ign: s, discordId: s })).concat(igns);
    processTwitch(streams);

    // Check for Extra Life
    if (extraLife() && (new Date().getMinutes() < 5)) {
      const embed = await extraLifeEmbed();
      if (embed) Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds : [embed] });
    }
  } catch (e) { u.errorHandler(e, "Stream Check"); }
}

async function extraLifeEmbed() {
  try {
    const streams = await fetchExtraLifeStreams();
    if (!streams || streams.data.length === 0) return;
    const embed = u.embed()
      .setTitle("Live from the Extra Life Team!")
      .setColor(0x7fd836);

    const channels = streams.data.sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)).map(s => {
      const game = twitchGames.get(s.gameId)?.name;
      return `**${s.userDisplayName} ${game ? ` playing ${game}` : ""}**\n[${s.title}](https://twitch.tv/${s.userDisplayName})`;
    });
    const embeds = await u.pagedEmbeds(null, embed, channels);
    embed.setDescription(embeds?.[0] ?? null);
    return embed;
  } catch (error) {
    u.errorHandler(error, "Extra Life Embed Fetch");
  }
}

/** @param {ELAPI.Team | null} [team] */
async function fetchExtraLifeStreams(team) {
  try {
    if (!team) team = await fetchExtraLifeTeam().catch(() => null);
    if (!team) return null;
    const userName = team.participants.filter(m => m.links.stream)
      .map(p => p.links.stream.replace("https://player.twitch.tv/?channel=", ""))
      .filter(channel => !(channel.includes(" ") || channel.includes("/")));
    if (userName.length === 0) return { data: [] };
    return twitch.streams.getStreams({ userName }).catch(() => null);
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Streams");
    return { data: [] };
  }
}

async function fetchExtraLifeTeam() {
  try {
    const team = await extralifeApi.getTeamWithParticipants().catch(() => null);
    if (!team) return null;
    // Check donors while we're at it.
    const donations = await extralifeApi.getTeamDonations().catch(() => null);
    if (!donations) return team;
    const file = JSON.parse(fs.readFileSync("./data/extraLifeDonors.json", "utf8"));
    const donors = new Set(file.donors);
    const donationIDs = new Set(file.donationIDs);
    let update = false;

    for (const donation of donations) {
      if (donationIDs.has(donation.donationID)) continue;
      donationIDs.add(donation.donationID);
      update = true;

      if (donation.displayName && !donors.has(donation.displayName)) {
        donors.add(donation.displayName);
        const embed = u.embed().setColor(0x7fd836)
          .setTitle("New Extra Life Donor(s)")
          .setThumbnail("https://assets.donordrive.com/extralife/images/$event55p$/facebookImage.png")
          .setDescription(donation.displayName)
          .setTimestamp(new Date(donation.createdDateUTC));
        Module.client.getTextChannel(u.sf.channels.team)?.send({ embeds: [embed] });
      }

      const embed = u.embed()
        .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
        .setDescription(donation.message || "[ No Message ]")
        .addFields([
          { name: "Amount", value: `$${donation.amount}`, inline: true },
          { name: "Recipient", value: donation.recipientName, inline: true },
          { name: "Incentive", value: donation.incentiveID || "[ None ]", inline: true }
        ])
        .setColor(donation.participantID === extralifeApi.teamId || donation.message?.toLowerCase().includes("#ldsg") ? 0x7fd836 : 0x26c2eb)
        .setTimestamp(new Date(donation.createdDateUTC));
      Module.client.getTextChannel(u.sf.channels.team)?.send({ embeds: [embed] });
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
  const roles = [
    u.sf.roles.sponsors.onyx,
    u.sf.roles.sponsors.pro,
    u.sf.roles.sponsors.legendary,
    u.sf.roles.team
  ];
  if (extraLife()) roles.push(u.sf.roles.streaming.elteam);

  if (member.id === member.client.user.id) return true;
  return member.roles.cache.hasAny(...roles);
}

function notificationEmbed(stream) {
  const game = twitchGames.get(stream.gameId)?.name;
  return u.embed()
    .setTimestamp()
    .setColor("#6441A4")
    .setThumbnail(stream.thumbnailUrl.replace("{width}", "480"))
    .setAuthor({ name: `${stream.userDisplayName} ${game ? `playing ${game}` : ""}` })
    .setTitle(`🔴 ${stream.title}`)
    .setURL(stream.streamUrl);
}

async function processTwitch(igns) {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) return;
    const liveRole = ldsg.roles.cache.get(u.sf.roles.streaming.live);
    const notificationChannel = ldsg.client.getTextChannel(u.sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const userName = streamers.map(s => s.ign);
      const streams = await twitch.streams.getStreams({ userName })
        .catch(error => { u.errorHandler(error, "Twitch getStreams()"); });
      if (!streams) return;
      // Handle Live
      for (const stream of streams.data) {
        const status = twitchStatus.get(stream.userDisplayName.toLowerCase());
        if (!status || ((status.live === false) && ((Date.now() - status.since) >= (30 * 60 * 1000)))) {
          const rating = (await gameInfo(stream.gameId))?.rating;
          const url = twitchURL(stream.userDisplayName);
          if (stream.userDisplayName.toLowerCase() === "ldsgamers") {
            Module.client.user?.setActivity({
              name: stream.title,
              url,
              type: Discord.ActivityType.Streaming
            });
          }
          twitchStatus.set(stream.userDisplayName.toLowerCase(), {
            live: true,
            since: Date.now()
          });
          const ign = streamers.find(streamer => streamer.ign.toLowerCase() === stream.userDisplayName.toLowerCase());
          const member = await ldsg.members.fetch(ign.discordId).catch(u.noop);
          if (member && isPartnered(member)) member.roles.add(u.sf.roles.streaming.live).catch(u.noop);
          const embed = notificationEmbed(stream);
          let content;
          if ((rating !== "M - Mature 17+") &&
            extraLife() &&
            member &&
            member.roles.cache.has(u.sf.roles.streaming.elteam) &&
            (stream.title.toLowerCase().includes("extra life") || stream.title.toLowerCase().includes("extralife"))
          ) {
            content = `<@&${ldsg.roles.cache.get(u.sf.roles.streaming.twitchraiders)}>, **${member.displayName}** is live for Extra Life!`;
          }
          if (rating !== "M - Mature 17+") notificationChannel?.send({ content, embeds: [embed], allowedMentions: { parse: ["users"] } }).catch(u.noop);
        }
      }

      // Handle Offline
      const offline = streamers.filter(streamer => !streams.data.find(stream => stream.userDisplayName.toLowerCase() === streamer.ign.toLowerCase()));
      for (const channel of offline) {
        if (channel.ign.toLowerCase() === "ldsgamers") Module.client.user?.setActivity("Tiddlywinks");
        const member = ldsg.members.cache.get(channel.discordId);
        if (member && liveRole?.members.has(member.id)) member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
        const status = twitchStatus.get(channel.ign.toLowerCase());
        if (status && status.live) {
          twitchStatus.set(channel.ign.toLowerCase(), {
            live: false,
            since: Date.now()
          });
        }
      }
    }
  } catch (e) {
    u.errorHandler(e, "Process Twitch");
  }
}

async function buttonApproveStreamer(int) {
  const id = int.message.embeds[0]?.data.footer?.text;
  const member = int.guild.members.cache.get(id ?? "");
  await int.deferReply({ ephemeral: true });
  if (!member) return int.editReply("Sorry, I couldn't find that user!");
  if (!member.roles.cache.has(u.sf.roles.trusted)) return int.editReply(`${member} needs the Trusted role first!`);
  const content = await c.assignRole(int, member, u.sf.roles.streaming.approved);
  await member.send(approvalText).catch(u.noop);
  int.editReply(content);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeTeam(int) {
  if (!extraLife()) return int.reply({ content: notEL, ephemeral: true });
  await int.deferReply();
  const team = await fetchExtraLifeTeam();
  if (!team) return int.editReply("Sorry, looks like the Extra Life API is down! Try later!").then(u.clean);
  const streams = await fetchExtraLifeStreams(team).catch(u.noop);
  /** @type {Array} */
  const members = team.participants.map(p => {
    const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "");
    const stream = streams?.data.find(s => username && s.userDisplayName === username);
    return { ...p, username, isLive: Boolean(stream), stream };
  }).sort((a, b) => {
    if (a.isLive !== b.isLive) return (a.isLive === b.isLive) ? 0 : a.isLive ? -1 : 1;
    if (a.sumDonations !== b.sumDonations) return b.sumDonations - a.sumDonations;
    return a.displayName.localeCompare(b.displayName);
  });
  const total = members.reduce((p, cur) => p + cur.sumDonations, 0);
  const teamStrings = members.map(m => {
    const percent = Math.round(100 * m.sumDonations / m.fundraisingGoal);
    let str = `**${m.displayName}**\n$${m.sumDonations} / $${m.fundraisingGoal} (${percent}%)\n` +
      `[Donate](${m.links.donate})`;
    if (m.isLive) str += `\n### STREAM IS NOW LIVE\n[${m.stream.title}](https://twitch.tv/${m.twitch})`;
    return str;
  });

  const milestoneStrings = (team.milestones ?? []).map(m => {
    const str = `## $${m.fundraisingGoal}\n${m.description}`;
    return m.isComplete ? `~~${str}~~` : str;
  });

  const wallOfText = `LDSG is raising money for Extra Life! We are currently at $${total} of our team's $${team.fundraisingGoal} goal for ${new Date().getFullYear()}. That's ${Math.round(100 * total / team.fundraisingGoal)}% of the way there!\n\nYou can help by donating to one of the Extra Life Team members below.`;

  const embed = u.embed().setTitle("LDSG Extra Life Team")
    .setThumbnail("https://assets.donordrive.com/extralife/images/fbLogo.jpg?v=202009241356")
    .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${teamId}#teamTabs`)
    .setDescription(`${wallOfText}\n\n${teamStrings.join("\n\n")}\n\n${milestoneStrings.length > 0 ? `# Milestones:\n${milestoneStrings.join("\n")}` : ""}`);
  return int.editReply({ embeds: [embed] });
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeStreaming(int) {
  if (!extraLife()) return int.reply({ content: notEL, ephemeral: true });
  await int.deferReply();
  const embed = await extraLifeEmbed();
  if (embed) return int.editReply({ embeds: [embed] });
  int.editReply("Doesn't look like anyone's live right now!");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchLive(int) {
  await int.deferReply({ ephemeral: int.channelId !== u.sf.channels.botspam });
  const approved = int.guild.roles.cache.get(u.sf.roles.streaming.approved);
  const igns = await u.db.ign.getList("twitch").then(i => {
    return i.filter(ign => approved?.members.has(ign.discordId))
      .map(ign => ign.ign);
  });
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
  return u.pagedEmbeds(int, embed, lines, true);
}
Module
.addInteraction({
  id: u.sf.commands.slashTwitch,
  onlyGuild: true,
  process: (int) => {
    try {
      const subcommand = int.options.getSubcommand(true);
      switch (subcommand) {
        case "team": return slashTwitchExtralifeTeam(int);
        case "streaming": return slashTwitchExtralifeStreaming(int);
        case "live": return slashTwitchLive(int);
        default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    } catch (error) {
      u.errorHandler(error, int);
    }
  }
})
.addInteraction({
  id: "buttonApproveStreamer",
  type: "Button",
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["team", "mod"]),
  process: buttonApproveStreamer
})
.addEvent("guildMemberUpdate", (oldMember, newMember) => {
  const twitchSub = u.sf.roles.streaming.sub;
  const alertChannel = newMember.client.getTextChannel(u.sf.channels.team);
  const hexlogo = `<:hexlogo:${u.sf.emoji.hexlogo}>`;
  if (oldMember.roles.cache.has(twitchSub) && !newMember.roles.cache.has(twitchSub)) {
    newMember.send(`## It looks like your Twitch subscription to LDS Gamers has expired!\nTwitch Prime subscriptions need to be resubbed on a monthly basis. If this was unintentional, please consider resubbing at <https://www.twitch.tv/ldsgamers>. It helps keep the website and various game servers running. Thanks for the support! ${hexlogo}`).catch(u.noop);
    alertChannel?.send(`**${newMember} (${newMember.displayName})**'s Twitch Sub has expired!`);
  } else if (!oldMember.roles.cache.has(twitchSub) && newMember.roles.cache.has(twitchSub)) {
    newMember.send(`## Thanks for becoming an LDS Gamers Twitch Subscriber!\nPeople like you help keep the website and various game servers running. If you subscribed with a Twitch Prime sub, those need to be renewed monthly. You'll get a notification if I notice it lapse. Thanks for the support! ${hexlogo}`).catch(u.noop);
    alertChannel?.send(`**${newMember} (${newMember.displayName})** has become a Twitch Sub!`);
  }
})
.setInit((data) => {
  gamesDB._setKey(config.api.thegamesdb);
  if (data) {
    for (const [key, status] of data.twitchStatus) {
      twitchStatus.set(key, status);
    }
  }
})
.setClockwork(() => {
  const interval = 5 * 60 * 1000;
  return setInterval(checkStreams, interval);
});

module.exports = Module;
