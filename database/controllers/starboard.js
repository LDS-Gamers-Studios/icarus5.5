// @ts-check
const Starboard = require("../models/Starboard.model");

/**
 * @typedef StarboardPost
 * @prop {string} messageId
 * @prop {number} postedAt
 */

module.exports = {
  /**
   * @param {string} messageId
   * @returns {Promise<StarboardPost | null>}
   */
  getMessage: (messageId) => {
    return Starboard.findOne({ messageId }, { lean: true }).exec();
  },
  /**
   * @param {string} messageId
   * @param {number} postedAt
   * @returns {Promise<StarboardPost>}
   */
  saveMessage: (messageId, postedAt) => {
    return new Starboard({ messageId, postedAt }).save().then(d => d.toObject());
  },
  cleanup: () => {
    return Starboard.deleteMany({ postedAt: { $lt: Date.now() - 8 * 24 * 60 * 60_000 } }, { lean: true, new: false }).exec();
  }
};