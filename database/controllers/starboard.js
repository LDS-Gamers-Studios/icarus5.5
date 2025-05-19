// @ts-check
const Starboard = require("../models/Starboard.model");

/**
 * @typedef StarboardPost
 * @prop {string} messageId
 * @prop {number} posted
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
   * @param {number} posted
   * @returns {Promise<StarboardPost>}
   */
  saveMessage: (messageId, posted) => {
    return new Starboard({ messageId, posted }).save().then(d => d.toObject());
  },
  cleanup: () => {
    return Starboard.deleteMany({ posted: { $lt: Date.now() - 8 * 24 * 60 * 60_000 } }, { lean: true, new: false }).exec();
  }
};