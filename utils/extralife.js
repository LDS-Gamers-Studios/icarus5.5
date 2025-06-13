// @ts-check
const axios = require("axios");
const config = require("../config/config.json");

// this is only in its own file because of the huge types lol
/**
 * @typedef Links
 * @prop {string} [join]
 * @prop {string} [stream]
 * @prop {string} [page]
 * @prop {string} [donate]
 *
 * @typedef Team
 * @prop {number} numParticipants
 * @prop {number} fundraisingGoal
 * @prop {Links} links
 * @prop {boolean} streamIsLive
 * @prop {number} numIncentives
 * @prop {number} sumDonations
 * @prop {string} name
 * @prop {number} numMilestones
 * @prop {string} avatarImageURL
 * @prop {number} teamID
 * @prop {number} sumPledges
 * @prop {string} streamingChannel
 * @prop {number} numDonations
 * @prop {Participant[]} participants
 * @prop {Milestone[]} milestones
 *
 * @typedef Milestone
 * @prop {string} description
 * @prop {number} fundraisingGoal
 * @prop {boolean} isActive
 * @prop {boolean} [isComplete]
 * @prop {string} milestoneID
 *
 * @typedef Donation
 * @prop {string} displayName
 * @prop {string} donorId
 * @prop {string} recipientName
 * @prop {string} recipientImageURL
 * @prop {string} message
 * @prop {number} participantID
 * @prop {number} amount
 * @prop {string} avatarImageURL
 * @prop {string} donationID
 * @prop {string} createdDateUTC
 * @prop {string} [incentiveID]
 *
 * @typedef ParticipantExclusive
 * @prop {string} eventName
 * @prop {boolean} isTeamCoCaptain
 * @prop {number} participantID
 * @prop {string} teamName
 * @prop {string} displayName
 * @prop {string} participantTypeCode
 * @prop {boolean} isTeamCaptain
 *
 * @typedef {Omit<Team, "numParticipants"|"streamIsLive"|"name"|"streamingChannel"> & ParticipantExclusive} Participant
 */

const teamId = config.twitch.elTeam;

/** @param {string} path */
async function call(path) {
  // @ts-ignore
  return axios(`https://extralife.donordrive.com/api${path}`).then(/** @param {any} res */ res => res.data);
}

/** @returns {Promise<Team>} */
async function getTeam() {
  const team = await call(`/teams/${encodeURIComponent(teamId)}`);
  team.milestones = await call(`/teams/${encodeURIComponent(teamId)}/milestones`);
  team.participants = await call(`/teams/${encodeURIComponent(teamId)}/participants`);

  return team;
}

/** @returns {Promise<Donation[]>} */
function getTeamDonations() {
  return call(`/teams/${encodeURIComponent(teamId)}/donations`);
}


module.exports = { getTeam, getTeamDonations };