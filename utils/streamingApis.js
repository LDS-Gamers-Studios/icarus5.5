// @ts-check
const axios = require("axios");
const u = require("./utils");
const config = require("../config/config.json");
const extralife = require("./extralifeTypes");
const { Collection, GuildMember } = require("discord.js");
const Twitch = require("@twurple/api");
const TwitchAuth = require("@twurple/auth").AppTokenAuthProvider;

const GAMES_DB_API = "https://api.thegamesdb.net/v1";
const EXTRA_LIFE_API = "https://extralife.donordrive.com/api";
const EXTRA_LIFE_TEAM = config.twitch.elTeam;

const assets = {
  colors: { twitch: 0x6441A4, elGreen: 0x7fd836, elBlue: 0x26c2eb },
  elLogo: "https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png",
  elTeamLink: `https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${EXTRA_LIFE_TEAM}`
};

/*********************
 * CACHED API VALUES *
 *********************/
/** @type {Collection<string, { name: string, rating?: string }>} */
const twitchGames = new u.Collection();

/**
 * @typedef LiveUser
 * @prop {boolean} live
 * @prop {number} since
 * @prop {string} [userId]
 * @prop {Twitch.HelixStream | null} stream
 */

/** @type {Collection<string, LiveUser>} */
const twitchStatus = new u.Collection();


/************************
 * EXTRA LIFE FUNCTIONS *
 ************************/

/** @param {number} num */
function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}


const extraLife = {
  getTeam: async () => {
    /** @type {extralife.Team | undefined} */
    const team = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}`);
    if (!team) return null;

    /** @type {extralife.Milestone[]} */
    team.milestones = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/milestones`) ?? [];

    /** @type {extralife.Participant[]} */
    team.participants = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/participants`) ?? [];

    /** @type {extralife.Donation[]} */
    team.donations = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/donations`) ?? [];

    return team;
  },
  /** @returns {Promise<import("./extralifeTypes").Donation[]>} */
  getTeamDonations: () => {
    return call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_API)}/donations`)
      .then(data => data ?? []);
  },
  isExtraLife: () => config.devMode || [9, 10].includes(new Date().getMonth())
};


/********************
 * TWITCH FUNCTIONS *
 ********************/

/** @param {string} error  */
function twitchErrorHandler(error) {
  error = error.toString();
  if (config.twitch.clientSecret) error = error.replace(new RegExp(config.twitch.clientSecret, "g"), "<TWITCH SECRET>");
  if (config.api.thegamesdb) error = error.replace(new RegExp(config.api.thegamesdb, "g"), "<SECRET>");

  u.errorHandler(new Error(error), "Twitch API");
}

/**
 * Find the rating for a game given its name
 * @param {string} gameName
 * @returns {Promise<{ name: string, rating?: string }>}
 */
async function fetchGameRating(gameName) {
  try {
    if (!config.api.thegamesdb || !gameName) return { name: gameName };

    const got = twitchGames.get(gameName);
    if (got) return got;

    /** @type {{ game_title: string, rating: string }[] | undefined} */
    const apiGame = await call(`${GAMES_DB_API}/Games/ByGameName?apikey=${config.api.thegamesdb}&name=${encodeURIComponent(gameName)}&fields=rating,alternates`)
      .then(d => d.games);

    // the api can return multiple games since we use the alternates field
    const ratings = apiGame?.filter(g => g.game_title.toLowerCase() === gameName.toLowerCase() && g.rating !== "Not Rated");
    const withRating = { name: gameName, rating: ratings?.[0].rating };
    twitchGames.set(gameName, withRating);

    return withRating;
  } catch (error) {
    return { name: gameName };
  }
}

/** @param {GuildMember} member */
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
  if (extraLife.isExtraLife()) roles.push(u.sf.roles.streaming.elteam);

  return member.roles.cache.hasAny(...roles);
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
  twitchGames,
  twitchStatus,
  round,
  fetchGameRating,
  twitchErrorHandler,
  twitchURL,
  isPartnered,
};
