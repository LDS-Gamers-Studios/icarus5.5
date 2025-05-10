// @ts-check
const { nanoid } = require("nanoid");
const Reminder = require("../models/Reminder.model");

/**
 * @typedef Timer
 * @prop {string} id
 * @prop {string} discordId
 * @prop {string} reminder
 * @prop {number} timestamp
 * @prop {number} started
 * @prop {boolean} isTimer
 */

module.exports = {
  /** @returns {Promise<Timer[]>} */
  fetchAll: () => {
    return Reminder.find({}, undefined, { lean: true });
  },
  /**
   * @param {import("moment-timezone").Moment} cutoffDate
   * @returns {Promise<Timer[]>}
   */
  fetchUpcoming: (cutoffDate) => {
    return Reminder.find({ timestamp: { $lte: cutoffDate.valueOf() } });
  },
  /**
   * @param {string} discordId
   * @returns {Promise<Timer[]>}
  */
  fetchUser: (discordId) => {
    return Reminder.find({ discordId }, undefined, { lean: true });
  },
  /**
   * @param {Omit<Timer, "id">} reminder
   * @returns {Promise<Timer>}
   */
  save: (reminder) => {
    return Reminder.create({ ...reminder, id: nanoid(5).toUpperCase() }).then(r => r.toObject());
  },
  /**
   * @param {string} id
   * @param {string} discordId
   * @returns {Promise<Timer | null>}
   */
  deleteById: (id, discordId) => {
    return Reminder.findOneAndDelete({ id: id.toUpperCase(), discordId }, { lean: true, new: false });
  },
};