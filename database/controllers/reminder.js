// @ts-check
const { nanoid } = require("nanoid");
const Reminder = require("../models/Reminder.model");

/**
 * @typedef Timer
 * @prop {string} id The timer's ID
 * @prop {string} discordId The user's ID
 * @prop {string} reminder The reminder text
 * @prop {number} timestamp Timestamp of when the timer will go off
 * @prop {number} started Timestamp of when the timer was set
 * @prop {boolean} isTimer Whether its a timer or a reminder
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
    return Reminder.find({ timestamp: { $lte: cutoffDate.valueOf() } }, undefined, { lean: true });
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
    return new Reminder({ ...reminder, id: nanoid(5).toUpperCase() }).save().then(r => r.toObject());
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