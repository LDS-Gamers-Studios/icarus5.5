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
const api = require("../utils/streamingApis");

const teamId = config.twitch.elTeam;
const Module = new Augur.Module();

const colors = { elGreen: 0x7fd836, elBlue: 0x26c2eb, twitch: 0x6441A4 };

function extraLife() {
  return config.devMode || [9, 10].includes(new Date().getMonth());
}

/** @param {string} name */
function twitchURL(name) {
  return `https://twitch.tv/${encodeURIComponent(name)}`;
}


/** @type {Discord.Collection<string, { name: string, rating?: string }>} */
const twitchGames = new u.Collection();

/** @type {Discord.Collection<string, {live: boolean, since: number, userId?: string}>} */
const twitchStatus = new u.Collection();

const twitch = new Twitch.ApiClient({ authProvider: new TwitchAuth(config.twitch.clientId, config.twitch.clientSecret) });
const bonusStreams = require("../data/streams.json");

const approvalText = "## Congratulations!\n" +
  `You've been added to the Approved Streamers list in LDSG! This allows going live notifications to show up in <#${u.sf.channels.general}>, and grants access to stream to voice channels.\n` +
  "This has been done automatically, but please double check that your correct Twitch name is saved in the database with `/ign view twitch`. If the link doesn't work, try `/ign set twitch YourTwitchUsername`.\n\n" +
  "While streaming, please remember the [Streaming Guidelines](<https://goo.gl/Pm3mwS>) and [LDSG Code of Conduct](<http://ldsgamers.com/code-of-conduct>).\n" +
  "-# LDSG may make changes to the Approved Streamers list from time to time at its discretion.";

const notEL = "Extra Life isn't quite ready yet! Try again in November.";

/** @param {string} gameName */
async function gameInfo(gameName) {
  try {
    // can't find ratings, so no need to continue
    if (!config.api.thegamesdb || !gameName) return { name: gameName };

    // use cache if possible
    const got = twitchGames.get(gameName);
    if (got) return got;

    // fetch rating from thegamesdb
    const apiGame = await api.fetchGameRating(gameName);

    // the api can return multiple games since we use the alternates field
    const ratings = apiGame?.filter(g => g.game_title.toLowerCase() === gameName.toLowerCase() && g.rating !== "Not Rated");
    const withRating = { name: gameName, rating: ratings?.[0]?.rating };

    twitchGames.set(gameName, withRating);
    return withRating;

  } catch (error) {
    return { name: gameName };
  }
}

/** @param {string} error  */
function twitchErrorHandler(error) {
  error = error.toString()
    .replace(new RegExp(config.twitch.clientSecret, "g"), "<SECRET>")
    .replace(new RegExp(config.api.thegamesdb, "g"), "<SECRET>");
  u.errorHandler(new Error(error), "Twitch API");
}

async function checkStreams() {
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
    if (!extraLife() || now.getHours() % 2 === 1 || now.getMinutes() > 5) return;

    const embeds = await extraLifeEmbeds();
    for (const embed of embeds) {
      await Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
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
    const team = await api.extraLife.getTeam();
    if (!team) return null;

    // Check donors while we're at it.
    const donations = await api.extraLife.getTeamDonations();

    let update = false;

    /** @type {import("../utils/extralifeTypes").Donation[]}*/
    const newDonors = [];

    for (const donation of donations) {
      if (donationIDs.has(donation.donationID)) continue;

      donationIDs.add(donation.donationID);
      update = true;

      if (donation.displayName && !donors.has(donation.displayName)) {
        donors.add(donation.displayName);
        newDonors.push(donation);
      }

      const privateEmbed = u.embed()
        .setColor(colors.elBlue)
        .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
        .setDescription(donation.message || "[ No Message ]")
        .addFields([
          { name: "Amount", value: `$${donation.amount}`, inline: true },
          { name: "Recipient", value: donation.recipientName, inline: true },
          { name: "Incentive", value: donation.incentiveID || "[ None ]", inline: true }
        ])
        .setTimestamp(new Date(donation.createdDateUTC));
      Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [privateEmbed] });

      const publicEmbed = u.embed().setColor(colors.elBlue)
        .setTitle("New Extra Life Donation")
        .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${teamId}`)
        .setThumbnail("https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png")
        .setTimestamp(new Date(donation.createdDateUTC))
        .setDescription(`Someone just donated **$${donation.amount}** to our Extra Life team! That's ${almosts.getRandom()} **${prices.getRandom}!**\n(btw, that means we're at **$${team.sumDonations}**, which is **${(team.sumDonations / team.fundraisingGoal * 100).toFixed(2)}%** of the way to our goal!)`);

      Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [publicEmbed] });
    }

    if (newDonors.length > 0) {
      const embed = u.embed().setColor(colors.elBlue)
        .setTitle(`${newDonors.length} New Extra Life Donor(s)`)
        .setThumbnail(donations[0].avatarImageURL)
        .setDescription(donations.map(d => d.displayName).join("\n"))
        .setTimestamp(new Date(donations[0].createdDateUTC));

      Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });
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

    const liveRole = u.sf.roles.streaming.live;
    const notificationChannel = ldsg.client.getTextChannel(u.sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const users = streamers.map(s => s.ign);

      const streams = await twitch.streams.getStreamsByUserNames(users)
        .catch(twitchErrorHandler);

      if (!streams) continue;

      const sinceThreshold = Date.now() - 30 * 60_000;

      // Handle Live
      for (const stream of streams) {
        const status = twitchStatus.get(stream.userDisplayName.toLowerCase());

        // If they were streaming recently (within half an hour), don't post notifications
        if (status && (status.live || status.since > sinceThreshold)) continue;

        const game = await gameInfo(stream.gameName);

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
          .setColor(colors.twitch)
          .setThumbnail(stream.getThumbnailUrl(480, 270))
          .setAuthor({ name: `${stream.userDisplayName} ${game ? `is playing ${game.name}` : ""}` })
          .setTitle(`🔴 ${stream.title}`)
          .setDescription(`${member || stream.userDisplayName} went live on Twitch!`)
          .setURL(url);

        // check for extralife (has extralife role and extra life in title)
        if (extraLife() && (member ? member?.roles.cache.has(u.sf.roles.streaming.elteam) : true) && stream.title.toLowerCase().match(/extra ?life/)) {
          if (content) content = `**<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>** ${content}`;
          else content = `<@&${ldsg.roles.cache.get(u.sf.roles.streaming.elraiders)}>, **${member?.displayName ?? stream.userDisplayName}** is live for Extra Life!`;
          allowMentions = true;
          embed.setColor(colors.elGreen);
        }

        // send it!
        notificationChannel?.send({ content, embeds: [embed], allowedMentions: allowMentions ? { parse: ["roles"] } : undefined }).catch(u.noop);
      }

      // Handle Offline
      const offline = streamers.filter(streamer => !streams.find(stream => stream.userDisplayName.toLowerCase() === streamer.ign.toLowerCase()));

      for (const channel of offline) {
        const status = twitchStatus.get(channel.ign.toLowerCase());
        if (!status?.live) continue;

        if (channel.ign.toLowerCase() === "ldsgamers") Module.client.user?.setActivity({ name: "Tiddlywinks", type: Discord.ActivityType.Playing });

        const member = ldsg.members.cache.get(channel.discordId);
        if (member?.roles.cache.has(liveRole)) {
          member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
        }

        twitchStatus.set(channel.ign.toLowerCase(), {
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
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
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
async function slashTwitchLive(int) {
  const ephemeral = u.ephemeralChannel(int, u.sf.channels.botSpam);
  await int.deferReply({ flags: ephemeral });

  const approved = int.guild.roles.cache.get(u.sf.roles.streaming.approved)?.members ?? new u.Collection();
  // if (extraLife()) {
  //   const elTeam = int.guild.roles.cache.get(u.sf.roles.streaming.elteam)?.members;
  //   if (elTeam) approved = approved.concat(elTeam);
  // }

  let igns = await u.db.ign.findMany(approved.map(m => m.id) ?? [], "twitch")
    .then(i => i.map(ign => ign.ign.toLowerCase()));

  // Add extra life team members if applicable
  /** @type {Discord.Collection<string, import("../utils/extralifeTypes").Participant>} */
  let elParticipants = new u.Collection();
  if (extraLife()) {
    const team = await fetchExtraLifeTeam();

    elParticipants = new u.Collection(team?.participants.map(p => {
      const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "").toLowerCase() ?? "";
      return [username, p];
    }) ?? []);

    if (elParticipants.size > 0) igns = u.unique(igns.concat([...elParticipants.keys()]));
  }

  // This method only returns streams that are currently live
  /** @type {Promise<Twitch.HelixStream[]>[]} */
  const streamFetch = [];
  for (let i = 0; i < igns.length; i += 100) {
    const usernames = igns.slice(i, i + 100);
    streamFetch.push(twitch.streams.getStreamsByUserNames(usernames).catch(u.noop).then(s => s ?? []));
  }

  const res = await Promise.all(streamFetch).then(p => p.flat());

  const embed = u.embed()
    .setTitle(`Currently Streaming in ${int.guild.name}`)
    .setColor(colors.twitch)
    .setTimestamp();

  const channels = [];
  const elChannels = [];
  for (const stream of res) {
    const game = await gameInfo(stream.gameName);
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
      .setColor(colors.elGreen)
      .setTimestamp();

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

function writeCache() {
  const cutoff = u.moment().add(1, "hour").valueOf();
  fs.writeFileSync("./data/streamcache.txt", `${cutoff}\n${twitchStatus.map((s, n) => `${s.userId || ""};${s.live};${s.since};${n}`).join("\n")}`);
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
})
.addCommand({
  name: "checkstreams",
  permissions: () => config.devMode,
  process: checkStreams
})
.setClockwork(() => {
  const interval = 5 * 60_000;
  return setInterval(checkStreams, interval);
})
.setInit(async (data) => {
  if (data) {
    for (const [key, status] of data) {
      twitchStatus.set(key, status);
    }
  } else {
    if (fs.existsSync("./data/streamcache.txt")) {
      const cache = fs.readFileSync("./data/streamcache.txt", "utf-8").split("\n");
      const saved = cache.shift();
      if (parseInt(saved ?? "") > Date.now()) {
        for (const row of cache) {
          const [userId, live, since, name] = row.split(";");
          twitchStatus.set(name, { userId, live: live === "true", since: parseInt(since) });
        }
      }

      fs.unlinkSync("./data/streamcache.txt");
    }
    // reset live role on restart
    const members = Module.client.guilds.cache.get(u.sf.ldsg)?.roles.cache.get(u.sf.roles.streaming.live)?.members ?? new u.Collection();
    for (const [id, member] of members) {
      if (!twitchStatus.find(s => s.userId === id)) await member.roles.remove(u.sf.roles.streaming.live);
    }
  }
  if (config.devMode) checkStreams();
})
.setUnload(() => {
  delete require.cache[require.resolve("../data/streams.json")];
  return twitchStatus;
})
.setShared(writeCache);

module.exports = Module;
