// @ts-check
const axios = require("axios");

/**
 * @typedef Links
 * @prop {string} join
 * @prop {string} stream
 * @prop {string} page
 *
 * @typedef Team
 * @prop {number} numParticipants
 * @prop {number} fundraisingGoal
 * @prop {Links} links
 * @prop {boolean} hasActivityTracking
 * @prop {string} captainDisplayName
 * @prop {boolean} streamIsLive
 * @prop {boolean} hasTeamOnlyDonations
 * @prop {number} numIncentives
 * @prop {string} streamingPlatform
 * @prop {boolean} isCustomAvatarImage
 * @prop {number} eventID
 * @prop {number} sumDonations
 * @prop {string} createdDateUTC
 * @prop {number} sourceTeamID
 * @prop {string} name
 * @prop {number} numMilestones
 * @prop {string} avatarImageURL
 * @prop {number} teamID
 * @prop {boolean} streamIsEnabled
 * @prop {number} sumPledges
 * @prop {string} streamingChannel
 * @prop {number} numDonations
 * @prop {Participant[]} participants
 * @prop {Milestone[]} [milestones]
 *
 * @typedef Milestone
 * @prop {string} description
 * @prop {string} fundraisingGoal
 * @prop {boolean} isActive
 * @prop {boolean} isComplete
 * @prop {string} milestoneID
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
 * @typedef {Omit<Team, "numParticipants"|"captainDisplayName"|"streamIsLive"|"hasTeamOnlyDonations"|"streamingPlatform"|"sourceTeamID"|"name"|"streamIsEnabled"|"streamingChannel"> & ParticipantExclusive} Participant
 */

class ExtraLifeAPI {
  /** @param {string} [data] */
  constructor(data) {
    this.set(data);
    this.teams = new Map();
    this.participants = new Map();
  }

  /**
   * @param {string} path
   * @param {any} [data]
   */
  _call(path, data) {
    if (data) {
      path += "?" + Array.from(Object.keys(data)).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join("&");
    }
    return axios(`https://extralife.donordrive.com/api${path}`).then(res => res.data);
  }

  /**
   * @param {string} participantId
   * @returns {Promise<Participant>}
  */
  async getParticipant(participantId) {
    if (!participantId) throw Error("participantId must be provided");

    const participant = await this._call(`/participants/${encodeURIComponent(participantId)}`);
    this.participants.set(participantId, participant);

    return participant;
  }

  /**
   * @param {string} participantId
   * @returns {Promise<any>} not sure of return type yet
  */
  async getParticipantDonations(participantId) {
    if (!participantId) throw Error("participantId must be provided");

    const donations = await this._call(`/participants/${encodeURIComponent(participantId)}/donations`);

    return donations;
  }

  /**
   * @param {string} [teamId]
   * @returns {Promise<Team>}
   */
  async getTeam(teamId, withMilestones = true) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");

    const team = await this._call(`/teams/${encodeURIComponent(teamId)}`);
    if (withMilestones) {
      const milestones = await this._call(`/teams/${encodeURIComponent(teamId)}/milestones`);
      team.milestones = milestones;
    }
    this.teams.set(teamId, team);

    return { ...team, participants: [] };
  }

  /**
   * @param {string} [teamId]
   * @returns {Promise<any>} not sure of return type yet
  */
  async getTeamDonations(teamId) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");

    const donations = await this._call(`/teams/${encodeURIComponent(teamId)}/donations`);
    return donations;
  }

  /**
   * @param {string} [teamId]
   * @returns {Promise<Team>}
  */
  async getTeamWithParticipants(teamId) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");

    const team = await this.getTeam(teamId);
    const participants = await this._call(`/teams/${encodeURIComponent(teamId)}/participants`);
    return { ...team, participants };
  }

  /** @param {string | undefined} teamId */
  set(teamId) {
    this.teamId = teamId;
    return this;
  }
}

module.exports = { ExtraLifeAPI };