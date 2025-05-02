// @ts-check
const axios = require("axios");

/**
 * @param {string} path
 * @param {Record<any, any>} [params]
 */
function request(path, params) {
  // @ts-ignore
  return axios(`https://${path}`, { params })
    .then((/** @type {{ data: any }} */ a) => a.data);
}

/**
 * @typedef Station
 * @prop {string} name
 * @prop {number} id
 * @prop {string} type
 * @prop {number} distanceToArrival
 * @prop {{ name: string }} [controllingFaction]
 *
 * @typedef Faction
 * @prop {number} influence
 * @prop {string} name
 * @prop {string} state
 * @prop {string} allegiance
 * @prop {string} government
 * @prop {number} id
 *
 * @typedef EliteSystem
 * @prop {string} name
 * @prop {number} id
 * @prop {boolean} requirePermit
 * @prop {{ faction: string, allegiance: string, government: string, population: string } | null} information
 * @prop {{ isScoopable: boolean, type: string, name: string }} primaryStar
 * @prop {Body[]} bodies
 * @prop {Station[]} stations
 * @prop {Faction[]} factions
 * @prop {string} bodiesURL
 * @prop {string} stationsURL
 * @prop {string} factionsURL
 *
 * @typedef Body
 * @prop {number} id
 * @prop {string} type
 * @prop {boolean} isScoopable
 * @prop {number} distanceToArrival
 * @prop {string} name
*/

/** @param {string} systemName */
async function getSystemInfo(systemName) {
  const params = {
    showPrimaryStar: 1,
    showInformation: 1,
    showPermit: 1,
    showId: 1,
    systemName: systemName
  };
  /** @type {EliteSystem} */
  const starSystem = await request("www.edsm.net/api-v1/system", params);
  if (Array.isArray(starSystem)) return null;

  if (!starSystem.information || Object.keys(starSystem.information).length === 0) starSystem.information = null;

  const bodiesResponse = await request("www.edsm.net/api-system-v1/bodies", { systemName: systemName });
  starSystem.bodies = bodiesResponse.bodies;
  starSystem.bodiesURL = bodiesResponse.url;

  const stationsResponse = await request("www.edsm.net/api-system-v1/stations", { systemName: systemName });
  starSystem.stations = stationsResponse.stations;
  starSystem.stationsURL = stationsResponse.url;

  const factionsResponse = await request("www.edsm.net/api-system-v1/factions", { systemName: systemName });
  starSystem.factions = factionsResponse.factions;
  starSystem.factionsURL = factionsResponse.url;

  return starSystem;
}

/**
 * @returns {Promise<{ lastUpdate: string, type: string, message: string, status: number }>}
 */
function getEliteStatus() {
  return request("www.edsm.net/api-status-v1/elite-server");
}

module.exports = {
  getSystemInfo,
  getEliteStatus
};