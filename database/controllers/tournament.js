// @ts-check

const Tournament = require("../models/Tournament.model");

/**
 * @typedef Tournament
 * @prop {string} id
 * @prop {string} name
 * @prop {string} description
 * @prop {string} game
 * @prop {string} system
 * @prop {string} organizerId
 * @prop {Date} starts
 * @prop {{id: string, ign?: string}[]} participants
 */

module.exports = {
  /**
   * @param {Omit<Tournament, "participants">} tournament
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
    return Tournament.findOne({ id }, undefined, { lean: true });
  },
  /**
   * @param {string} id
   * @param {Omit<Tournament, "participants" | "id" | "organizerId">} tournament
   * @returns {Promise<Tournament | null>}
   */
  update: async (id, tournament) => {
    const t = await Tournament.findOne({ id }).exec();
    if (!t) return null;
    t.name = tournament.name;
    t.description = tournament.description;
    t.game = tournament.game;
    t.system = tournament.system;
    t.starts = tournament.starts;
    await t.save();
    return t.toObject();
  },
  /**
   * @param {string} id
   * @returns {Promise<Tournament | null>}
  */
  delete: (id) => {
    return Tournament.findOneAndDelete({ id }, { lean: true, old: true });
  },
  /**
   * Get a range of tournaments
   * @param {number} start
   * @param {number} end
   * @returns {Promise<Tournament[]>}
   */
  getRecent: async (start, end) => {
    const tourneys = await Tournament.find({}, undefined, { lean: true }).exec();
    return tourneys.sort((a, b) => a.starts.valueOf() - b.starts.valueOf())
      .filter((t, i) => i >= start && i <= end);
  },
  /**
   * @param {string} id
   * @param {string} userId
   * @param {string | undefined} ign
   * @returns {Promise<Tournament|void>}
   */
  addParticipant: async (id, userId, ign) => {
    const t = await Tournament.findOne({ id });
    if (!t) return;
    if (!t.participants.find(p => p.id === userId)) t.participants.push({ id: userId, ign });
    await t.save();
    return t.toObject();
  },
  /**
   * @param {string} id
   * @param {string} userId
   * @param {string} ign
   * @returns {Promise<Tournament|void>}
   */
  modifyParticipant: async (id, userId, ign) => {
    const t = await Tournament.findOne({ id });
    if (!t) return;
    for (const p of t.participants) {
      if (p.id === userId) {
        p.ign = ign;
        break;
      }
    }
    await t.save();
    return t.toObject();
  },
  /**
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Tournament|void>}
   */
  removeParticipant: async (id, userId) => {
    const t = await Tournament.findOne({ id });
    if (!t) return;
    t.participants = t.participants.filter(p => p.id !== userId);
    t.save();
    return t.toObject();
  },
};