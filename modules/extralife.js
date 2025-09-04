// @ts-check
const Augur = require("augurbot-ts");
const api = require("../utils/streamingApis");
const config = require("../config/config.json");
const u = require("../utils/utils");
const fs = require("fs");
const NoRepeat = require("no-repeat");

/** @typedef {api.LiveUser} LiveUser */

const teamId = config.twitch.elTeam;

const { twitchURL, extraLife: { isExtraLife }, assets } = api;
const notEL = "Extra Life isn't quite ready yet! Try again in October.";

const Module = new Augur.Module();

/************
 * COMMANDS *
 ************/
/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashTwitchExtralifeTeam(int) {
  if (!isExtraLife()) return int.reply({ content: notEL, flags: ["Ephemeral"] });
  await int.deferReply();

  const team = await api.extraLife.getTeam();
  if (!team) return int.editReply("Sorry, looks like the Extra Life API is down! Try later!").then(u.clean);

  const streams = await fetchExtraLifeStreams(team);
  const members = team.participants.map(p => {
    const username = p.links.stream?.replace("https://player.twitch.tv/?channel=", "");
    const stream = streams.find(s => username && s.stream?.userDisplayName === username);
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

    if (m.isLive) str += `\n### STREAM IS NOW LIVE\n[${m.stream?.stream?.title ?? "Watch Here"}](https://twitch.tv/${m.username})`;
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

/**
 * Also does donation checks
 * @param {import("../utils/extralifeTypes").Team | null} [team]
 */
async function fetchExtraLifeStreams(team) {
  /** @type {LiveUser[]} */
  const defaultValue = [];

  try {
    if (!team) team = await api.extraLife.getTeam();
    if (!team) return defaultValue;

    doDonationChecks(team);

    const users = team.participants.filter(m => m.links.stream)
      .map(p => p.links.stream?.replace("https://player.twitch.tv/?channel=", "").toLowerCase() ?? "")
      .filter(channel => !(channel.includes(" ") || channel.includes("/")));

    if (users.length === 0) return defaultValue;
    return [...api.twitchStatus.filter(s => users.includes(s.stream?.userName || "")).values()];
  } catch (error) {
    u.errorHandler(error, "Fetch Extra Life Streams");
    return defaultValue;
  }
}

/** @type {Set<string>} */
const donors = new Set();

/** @type {Set<string>} */
const donationIDs = new Set();

function loadDonationCache() {
  const path = "./data/extralifeDonors.json";
  if (!fs.existsSync(path)) return;

  /** @type {{ donors: string[], donationIDs: string[] }} */
  const file = JSON.parse(fs.readFileSync(path, "utf-8"));

  for (const donor of file.donors) donors.add(donor);
  for (const id of file.donationIDs) donationIDs.add(id);
}

/******************************
 * DONATION PRICE COMPARISONS *
 ******************************/

const almosts = new NoRepeat([
  "almost",
  "like",
  "basically equivalent to",
  "essentially",
  "the same as"
]);


/** @type {NoRepeat<(num: number) => string>} */
const prices = new NoRepeat([
  (num) => `${api.round(num * 3.84615384)} buttermelons`,
  (num) => `${api.round(num * 15.5)}oz of beans`,
  (num) => `${api.round(num * 100)} <:gb:493084576470663180>`,
  (num) => `${api.round(num * 12 / 2.97)} ice cream sandwiches`,
  (num) => `${api.round(num / 4.99)} handicorn sets`,
  (num) => `${api.round(num / 29.99)} copies of Minecraft`,
  (num) => `${api.round(num / 5)} copies of Shrek`,
  (num) => `${api.round(num / 27.47)} ink cartridges`
]);

/** @param {import("../utils/extralifeTypes").Team} team */
async function doDonationChecks(team) {
  let update = false;

  /** @type {import("../utils/extralifeTypes").Donation[]}*/
  const newDonors = [];

  for (const donation of team.donations) {
    if (donationIDs.has(donation.donationID)) continue;

    donationIDs.add(donation.donationID);
    update = true;

    if (donation.displayName && !donors.has(donation.displayName.toLowerCase())) {
      donors.add(donation.displayName.toLowerCase());
      newDonors.push(donation);
    }

    const embed = u.embed()
      .setTitle("New Extra Life Donation")
      .setURL(assets.elTeamLink)
      .setThumbnail(assets.elLogo)
      .setColor(assets.colors.elBlue)
      .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
      .setDescription(donation.message || "[ No Message ]")
      .setTimestamp(new Date(donation.createdDateUTC))
      .setFields([
        { name: "Amount", value: `$${donation.amount}`, inline: true },
        { name: "Recipient", value: donation.recipientName, inline: true },
        { name: "Incentive", value: donation.incentiveID || "[ None ]", inline: true }
      ]);

    Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });

    embed.setAuthor(null)
      .setFields([])
      .setDescription(
        `Someone just donated **$${donation.amount}** to our Extra Life team! That's ${almosts.getRandom()} **${prices.getRandom}!**\n` +
        `(btw, that means we're at **$${team.sumDonations}**, which is **${(team.sumDonations / team.fundraisingGoal * 100).toFixed(2)}%** of the way to our goal!)`
      );

    Module.client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
  }

  if (newDonors.length > 0) {
    const dono = team.donations[0];
    const embed = u.embed().setColor(assets.colors.elBlue)
      .setTitle(`${newDonors.length} New Extra Life Donor(s)`)
      .setThumbnail(dono.avatarImageURL)
      .setDescription(team.donations.map(d => d.displayName).join("\n"))
      .setTimestamp(new Date(dono.createdDateUTC));

    Module.client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });
  }

  if (update) {
    fs.writeFileSync("./data/extraLifeDonors.json", JSON.stringify({ donors: [...donors], donationIDs: [...donationIDs] }));
  }
}

/**
 * @param {LiveUser[]} streams
 */
async function extraLifeEmbeds(streams) {
  try {
    if (!streams || streams.length === 0) return [];

    const embed = u.embed()
      .setTitle("Live from the Extra Life Team!")
      .setImage(assets.elLogo)
      .setColor(assets.colors.elGreen);

    const channels = streams.sort((a, b) => (a.stream?.userDisplayName ?? "").localeCompare(b.stream?.userDisplayName ?? "")).map(s => {
      const game = api.twitchGames.get(s.stream?.gameId ?? "")?.name;
      return `**${s.stream?.userDisplayName} ${game ? `playing ${game}` : ""}**\n[${u.escapeText(s.stream?.title || "")}](${twitchURL(s.stream?.userDisplayName || "")}\n`;
    });

    return u.pagedEmbedsDescription(embed, channels);
  } catch (error) {
    u.errorHandler(error, "Extra Life Embed Fetch");
    return [];
  }
}

async function alerts() {
  const streams = await fetchExtraLifeStreams();
  const embeds = await extraLifeEmbeds(streams);
  return embeds;
}

Module.setShared({
  slashTwitchExtralifeTeam,
  alerts,
  doDonationChecks
})
.setInit(() => {
  loadDonationCache();
});

/**
 * @typedef {{ slashTwitchExtralifeTeam: slashTwitchExtralifeTeam, alerts: alerts, doDonationChecks: doDonationChecks }} ExtraLifeShared
 */

module.exports = Module;