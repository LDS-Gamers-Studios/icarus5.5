// @ts-check
const axios = require("axios");
const u = require("./utils");
const config = require("../config/config.json");
const extralife = require("./extralifeTypes");
const { Collection, Client } = require("discord.js");
const Twitch = require("@twurple/api");
const TwitchAuth = require("@twurple/auth").AppTokenAuthProvider;
const fs = require("fs");
const NoRepeat = require("no-repeat");

const GAMES_DB_API = "https://api.thegamesdb.net/v1";
const EXTRA_LIFE_API = "https://extralife.donordrive.com/api";
const EXTRA_LIFE_TEAM = config.twitch.elTeam;

/**
 * Find the rating for a game given its name
 * @param {string} gameName
 * @param {Collection<string, {name: string, rating?: string}>} cache
 * @returns {Promise<{ name: string, rating?: string }>}
 */
async function fetchGameRating(gameName, cache) {
  try {
    if (!config.api.thegamesdb || !gameName) return { name: gameName };

    const got = cache.get(gameName);
    if (got) return got;

    /** @type {{ game_title: string, rating: string }[] | undefined} */
    const apiGame = await call(`${GAMES_DB_API}/Games/ByGameName?apikey=${config.api.thegamesdb}&name=${encodeURIComponent(gameName)}&fields=rating,alternates`)
      .then(d => d.games);

    // the api can return multiple games since we use the alternates field
    const ratings = apiGame?.filter(g => g.game_title.toLowerCase() === gameName.toLowerCase() && g.rating !== "Not Rated");
    const withRating = { name: gameName, rating: ratings?.[0].rating };
    cache.set(gameName, withRating);

    return withRating;
  } catch (error) {
    return { name: gameName };
  }
}


/************************
 * EXTRA LIFE FUNCTIONS *
 ************************/

/** @param {number} num */
function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

const assets = {
  el: {
    logo: "https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png",
    teamLink: `https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${config.twitch.elTeam}`
  },
  colors: { elGreen: 0x7fd836, elBlue: 0x26c2eb, twitch: 0x6441A4 }
};

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
  (num) => `${round(num * 3.84615384)} buttermelons`,
  (num) => `${round(num * 15.5)}oz of beans`,
  (num) => `${round(num * 100)} <:gb:493084576470663180>`,
  (num) => `${round(num * 12 / 2.97)} ice cream sandwiches`,
  (num) => `${round(num / 4.99)} handicorn sets`,
  (num) => `${round(num / 29.99)} copies of Minecraft`,
  (num) => `${round(num / 5)} copies of Shrek`,
  (num) => `${round(num / 27.47)} ink cartridges`
]);

const extraLife = {
  /** @param {Client} client */
  getTeam: async (client) => {
    /** @type {extralife.Team | undefined} */
    const team = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}`);
    if (!team) return null;

    /** @type {extralife.Milestone[]} */
    team.milestones = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/milestones`) ?? [];

    /** @type {extralife.Participant[]} */
    team.participants = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/participants`) ?? [];

    /** @type {extralife.Donation[]} */
    const donations = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_API)}/donations`) ?? [];

    let update = false;

    /** @type {import("../utils/extralifeTypes").Donation[]}*/
    const newDonors = [];

    for (const donation of donations) {
      if (donationIDs.has(donation.donationID)) continue;

      donationIDs.add(donation.donationID);
      update = true;

      if (donation.displayName && !donors.has(donation.displayName.toLowerCase())) {
        donors.add(donation.displayName.toLowerCase());
        newDonors.push(donation);
      }

      const embed = u.embed()
        .setTitle("New Extra Life Donation")
        .setURL(assets.el.teamLink)
        .setThumbnail(assets.el.logo)
        .setColor(assets.colors.elBlue)
        .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
        .setDescription(donation.message || "[ No Message ]")
        .setTimestamp(new Date(donation.createdDateUTC))
        .setFields([
          { name: "Amount", value: `$${donation.amount}`, inline: true },
          { name: "Recipient", value: donation.recipientName, inline: true },
          { name: "Incentive", value: donation.incentiveID || "[ None ]", inline: true }
        ]);

      client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });

      embed.setAuthor(null)
        .setFields([])
        .setDescription(
          `Someone just donated **$${donation.amount}** to our Extra Life team! That's ${almosts.getRandom()} **${prices.getRandom}!**\n` +
          `(btw, that means we're at **$${team.sumDonations}**, which is **${(team.sumDonations / team.fundraisingGoal * 100).toFixed(2)}%** of the way to our goal!)`
        );

      client.getTextChannel(u.sf.channels.general)?.send({ embeds: [embed] });
    }

    if (newDonors.length > 0) {
      const embed = u.embed().setColor(assets.colors.elBlue)
        .setTitle(`${newDonors.length} New Extra Life Donor(s)`)
        .setThumbnail(donations[0].avatarImageURL)
        .setDescription(donations.map(d => d.displayName).join("\n"))
        .setTimestamp(new Date(donations[0].createdDateUTC));

      client.getTextChannel(u.sf.channels.team.team)?.send({ embeds: [embed] });
    }

    if (update) {
      fs.writeFileSync("./data/extraLifeDonors.json", JSON.stringify({ donors: [...donors], donationIDs: [...donationIDs] }));
    }

    return team;
  },
  /** @returns {Promise<import("./extralifeTypes").Donation[]>} */
  getTeamDonations: () => {
    return call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_API)}/donations`)
      .then(data => data ?? []);
  },
  isExtraLife: () => config.devMode || [9, 10].includes(new Date().getMonth())
};


/** @param {string} error  */
function twitchErrorHandler(error) {
  error = error.toString();
  if (config.twitch.clientSecret) error = error.replace(new RegExp(config.twitch.clientSecret, "g"), "<TWITCH SECRET>");
  if (config.api.thegamesdb) error = error.replace(new RegExp(config.api.thegamesdb, "g"), "<SECRET>");

  u.errorHandler(new Error(error), "Twitch API");
}


/**
 * @template T
 * @param {string} url
 * @returns {Promise<T | undefined>}
 */
function call(url) {
  // @ts-ignore
  return axios(url).catch(twitchErrorHandler)
    .then(/** @param {{ data: T }} res */res => res?.data);
}

/** @param {string} name */
function twitchURL(name) {
  return `https://twitch.tv/${encodeURIComponent(name)}`;
}

const twitch = new Twitch.ApiClient({ authProvider: new TwitchAuth(config.twitch.clientId, config.twitch.clientSecret) });

module.exports = {
  assets,
  extraLife,
  twitch,
  round,
  fetchGameRating,
  twitchErrorHandler,
  twitchURL,
  loadDonationCache
};
