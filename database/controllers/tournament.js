// @ts-check

const { nanoid } = require("nanoid");
const Tournament = require("../models/Tournament.model");
const names = require("../../data/nameParts.json");

/**
 * @typedef EliminationBracket
 * @prop {number} startSeed
 * @prop {number} position
 * @prop {number} fightingFor
 * @prop {number} lostRound
 * @prop {number} lossReason
 *
 * @typedef RRRound
 * @prop {string} opponentId
 * @prop {number} score
 * @prop {number} lossReason
 *
 * @typedef Participant
 * @prop {string} id
 * @prop {string} [ign]
*
* @typedef Team
* @prop {string} id
* @prop {string} name
* @prop {boolean} roundOver
* @prop {EliminationBracket} elimBracket
* @prop {RRRound[]} rrRounds
* @prop {Participant[]} participants
* @prop {boolean} checkedIn
 *
 * @typedef BaseTourney
 * @prop {string} name
 * @prop {string} description
 * @prop {string} details
 * @prop {string} [system]
 * @prop {string} organizerId
 * @prop {number} starts
 * @prop {number} roundLength
 * @prop {number} bracketStyle
 * @prop {number} teamSize
 * @prop {boolean} [over]
 *
 * @typedef ExtraTourney
 * @prop {string} id
 * @prop {number} round
 * @prop {Team[]} teams
 * @prop {string[]} winners
 *
 * @typedef {BaseTourney & ExtraTourney} Tournament
 */

/** @param {Tournament} tournament */
function removeEmptyTeams(tournament) {
  return tournament.teams.filter(te => te.participants.length > 0);
}

module.exports = {
  /**
   * @param {BaseTourney & {id: string}} tournament
   * @returns {Promise<Tournament>}
   */
  create: (tournament) => {
    return Tournament.create(tournament).then(t => t.toObject());
  },
  /**
   * @param {string} id
   * @returns {Promise<Tournament | null>}
  */
  get: (id) => {
    return Tournament.findOne({ id }, undefined, { lean: true }).exec();
  },
  /**
   * Get a list of tournaments
   * @param {number} [limit]
   * @returns {Promise<Tournament[]>}
   */
  getList: async (limit = 50) => {
    return Tournament.find({}, undefined, { lean: true })
      .sort({ starts: "asc" })
      .limit(limit).exec();
  },
  /**
   * @param {string} tourneyId
   * @param {Tournament} tournament
   * @returns {Promise<Tournament | null>}
   */
  update: async (tourneyId, tournament) => {
    let t = await Tournament.findOne({ id: tourneyId }).exec();
    if (!t) return null;
    t = Object.assign(t, tournament);
    // cleanup and save
    t.teams = removeEmptyTeams(t);
    return t.save().then(o => o.toObject());
  },
  /**
   * @param {string} id
   * @returns {Promise<Tournament | null>}
  */
  delete: (id) => {
    return Tournament.findOneAndDelete({ id }, { lean: true, old: true });
  },
  /**
   * @param {string} tourneyId
   * @param {string} userId
   * @param {string | undefined} ign
   * @param {{id: string, name: string}} team
   * @returns {Promise<Tournament|void>}
   */
  manageParticipant: async (tourneyId, userId, ign, team) => {
    const tourney = await Tournament.findOne({ id: tourneyId });
    if (!tourney) return;

    let removed = false;
    let inserted = false;

    const newId = nanoid();
    const newTeam = {
      id: newId,
      name: team.name || names.names[Math.floor(Math.random() * names.names.length)],
      participants: [{ id: userId, ign }],
      elimBracket: {
        startSeed: 0,
        position: 0,
        lossReason: 0,
        lostRound: 0,
        fightingFor: 0,
      },
      roundOver: false,
      rrRounds: [],
      checkedIn: false,
    };

    if (team.id === "new") {
      tourney.teams.push(newTeam);
      inserted = true;
    }

    for (const t of tourney.teams) {
      if (removed && inserted) break;
      if (!removed && t.id !== newId) {
        const found = t.participants.findIndex(p => p.id === userId);
        if (found > -1) {
          t.participants.splice(found, 1);
          removed = true;
        }
      }
      if (!inserted && t.id === team.id) {
        if (team.name) t.name = team.name;
        t.participants.push({ id: userId, ign });
        inserted = true;
      }
    }

    if (!inserted) {
      tourney.teams.push(newTeam);
    }

    // cleanup and save
    tourney.teams = removeEmptyTeams(tourney);
    return tourney.save().then(o => o.toObject());
  },
  /**
   * @param {string} id
   * @param {Team[]} modifiedTeams
   * @returns
   */
  setRoundResults: async (id, modifiedTeams) => {
    const tourney = await Tournament.findOne({ id });
    if (!tourney) return;

    for (const t of modifiedTeams) {
      const i = t.participants.findIndex(obj => obj.id === t.id);
      tourney.teams[i] = t;
    }
    // cleanup and save
    tourney.teams = removeEmptyTeams(tourney);
    return tourney.save().then(o => o.toObject());
  },
  /**
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Tournament|void>}
   */
  removeParticipant: async (id, userId) => {
    const tourney = await Tournament.findOne({ id }).exec();
    if (!tourney) return;

    // filter them out
    tourney.teams = tourney.teams.map(t => {
      t.participants = t.participants.filter(p => p.id !== userId);
      return t;
    });
    // cleanup and save
    tourney.teams = removeEmptyTeams(tourney);
    return tourney.save().then(o => o.toObject());
  },
  /**
   * @param {string} id
   * @param {string} teamId
   * @returns {Promise<Tournament|null>}
   */
  checkin: async (id, teamId) => {
    return Tournament.findOneAndUpdate({ id, "teams.id": teamId }, { "teams.$.checkedIn": true }, { lean: true, new: true }).exec() ?? null;
  }
};