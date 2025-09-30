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
const EXTRA_LIFE_TEAM = encodeURIComponent(config.twitch.elTeam);

const assets = {
  colors: { twitch: 0x6441A4, elGreen: 0x7fd836, elBlue: 0x26c2eb },
  elLogo: "https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png",
  elTeamLink: `https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=${EXTRA_LIFE_TEAM}`
};

/*********************
 * CACHED API VALUES *
 *********************/
/** @type {Collection<string, { name: string, ratedM: boolean }>} */
const twitchGames = new u.Collection();

/**
 * @typedef LiveUser
 * @prop {boolean} live
 * @prop {number} sinceLiveChange
 * @prop {string} userId
 * @prop {boolean} isExtraLife
 * @prop {Pick<Twitch.HelixStream, "gameName" | "gameId" | "title" | "userDisplayName">} stream
 */

/**
 * Username -> LiveUser
 * @type {Collection<string, LiveUser>}
 */
const twitchStatus = new u.Collection();

/** @type {extralife.Team | null} */
let cachedELTeam = null;


/************************
 * EXTRA LIFE FUNCTIONS *
 ************************/

/** @param {number} num */
function round(num) {
  return Math.round(num * 100) / 100;
}

const extraLife = {
  // to avoid api limits, data is only fetched when the count changes.
  getTeam: async () => {
    if (!config.twitch.enabled || !config.twitch.elTeam) return null;

    /** @type {extralife.Team | undefined} */
    const team = await call(`${EXTRA_LIFE_API}/teams/${EXTRA_LIFE_TEAM}`);
    if (!team) return cachedELTeam;

    if (!cachedELTeam || cachedELTeam.numMilestones !== team.numMilestones) {
      /** @type {extralife.Milestone[]} */
      team.milestones = await call(`${EXTRA_LIFE_API}/teams/${EXTRA_LIFE_TEAM}/milestones`) ?? [];
      team.milestones.sort((a, b) => a.fundraisingGoal - b.fundraisingGoal);
    }

    if (!cachedELTeam || cachedELTeam.numParticipants !== team.numParticipants) {
      /** @type {extralife.Participant[]} */
      team.participants = await call(`${EXTRA_LIFE_API}/teams/${EXTRA_LIFE_TEAM}/participants`) ?? [];
    }

    if (!cachedELTeam || cachedELTeam.numDonations !== team.numDonations) {
      /** @type {extralife.Donation[]} */
      team.donations = await call(`${EXTRA_LIFE_API}/teams/${EXTRA_LIFE_TEAM}/donations`) ?? [];
    }

    cachedELTeam = team;
    return team;
  },
  isExtraLife: () => config.devMode || [8, 9, 10].includes(new Date().getMonth())
};


/********************
 * TWITCH FUNCTIONS *
 ********************/

/** @param {string} error  */
function twitchErrorHandler(error) {
  error = error.toString();
  if (config.twitch.clientSecret) error = error.replace(new RegExp(config.twitch.clientSecret, "g"), "<TWITCH SECRET>");
  if (config.api.thegamesdb) error = error.replace(new RegExp(config.api.thegamesdb, "g"), "<GAMES DB SECRET>");

  u.errorHandler(new Error(error), "Twitch API");
}

/**
 * Find the rating for a game given its name
 * @param {string} gameName
 * @returns {Promise<boolean>}
 */
async function isRatedM(gameName) {
  try {
    if (!config.api.thegamesdb || !gameName) return false;
    gameName = gameName.toLowerCase();

    const cached = twitchGames.get(gameName);
    if (cached) return cached.ratedM;

    /** @type {{ game_title: string, rating: string, alternates: string[] | null }[]} */
    const apiGames = await call(`${GAMES_DB_API}/Games/ByGameName?apikey=${config.api.thegamesdb}&name=${encodeURIComponent(gameName)}&fields=rating,alternates`)
      .then(d => d.games) || [];

    // the api can return multiple games as well as aliases since we use the alternates field. default to the first game if it can't find it (games are sorted by relevance)
    const ratedGame = apiGames.find(g => (g.game_title.toLowerCase() === gameName || g.alternates?.find(a => a.toLowerCase() === gameName)) && g.rating !== "Not Rated") || apiGames[0];
    const withRating = { name: gameName, ratedM: ratedGame?.rating === "M - Mature 17+" };
    twitchGames.set(gameName, withRating);

    return withRating.ratedM;
  } catch (error) {
    return false;
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
  isRatedM,
  twitchErrorHandler,
  twitchURL,
  isPartnered,
};
