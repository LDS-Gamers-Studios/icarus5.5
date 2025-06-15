// @ts-check
const axios = require("axios");
const u = require("./utils");
const config = require("../config/config.json");
const extralife = require("./extralifeTypes");

const GAMES_DB_API = "https://api.thegamesdb.net/v1";
const EXTRA_LIFE_API = "https://extralife.donordrive.com/api";
const EXTRA_LIFE_TEAM = config.twitch.elTeam;
/**
 * Find the rating for a game given its name
 * @param {string} gameName
 * @returns {Promise<{ game_title: string, rating: string }[] | undefined>}
 */
function fetchGameRating(gameName) {
  return call(`${GAMES_DB_API}/Games/ByGameName?apikey=${config.api.thegamesdb}&name=${encodeURIComponent(gameName)}&fields=rating,alternates`)
    .then(data => data.games);
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
  error = error.toString()
    .replace(new RegExp(config.twitch.clientSecret, "g"), "<SECRET>")
    .replace(new RegExp(config.api.thegamesdb, "g"), "<SECRET>");
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
  fetchGameRating
};