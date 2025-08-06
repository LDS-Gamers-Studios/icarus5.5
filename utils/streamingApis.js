// @ts-check
const axios = require("axios");
const u = require("./utils");
const config = require("../config/config.json");
const extralife = require("./extralifeTypes");
const { Collection } = require("discord.js");

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


const extraLife = {
  getTeam: async () => {
    /** @type {(extralife.Team & { milestones: extralife.Milestone[], participants: extralife.Participant[] }) | undefined} */
    const team = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}`);
    if (!team) return null;

    /** @type {extralife.Milestone[] | undefined} */
    team.milestones = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/milestones`) ?? [];

    /** @type {extralife.Participant[] | undefined} */
    team.participants = await call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_TEAM)}/participants`) ?? [];

    return team;
  },
  /** @returns {Promise<import("./extralifeTypes").Donation[]>} */
  getTeamDonations: () => {
    return call(`${EXTRA_LIFE_API}/teams/${encodeURIComponent(EXTRA_LIFE_API)}/donations`)
      .then(data => data ?? []);
  }
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


module.exports = {
  extraLife,
  fetchGameRating,
  twitchErrorHandler
};