// @ts-check
const Ign = require("../models/Ign.model");

/**
 * @typedef IGN
 * @prop {string} [discordId]
 * @prop {string} [system]
 * @prop {string} [ign]
 */

module.exports = {
  /**
   * Delete an IGN
   * @function delete
   * @param {string} discordId Which user's IGN to delete
   * @param {string} system Which system IGN to delete
   * @returns {Promise<IGN | null>}
   */
  delete: function(discordId, system) {
    return Ign.findOneAndRemove({ discordId, system }, { lean: true, new: false }).exec();
  },
  /**
   * Find an IGN
   * @function find
   * @param {string} discordId Which user's IGN to find
   * @param {(string)} [system] Which system IGN to find
   * @returns {Promise<Array<IGN>|IGN|null>}
   */
  find: function(discordId, system) {
    if (Array.isArray(system)) return Ign.find({ discordId, system: { $in: system } }).exec();
    else if (Array.isArray(discordId)) return Ign.find({ discordId: { $in: discordId }, system }).exec();
    else if (system) return Ign.findOne({ discordId, system }).exec();
    else return Ign.find({ discordId }).exec();
  },
  /**
   * Find a list of IGNs for a given system
   * @function getList
   * @param {string} system Whcih system list to fetch
   * @returns {Promise<Array<IGN>>}
   */
  getList: function(system) {
    return Ign.find({ system }).exec();
  },
  /**
   * Save a user's IGN
   * @function save
   * @param {string} discordId Which user's IGN to save
   * @param {string} system Which system IGN to save
   * @param {string} ign The IGN to save
   * @returns {Promise<IGN>}
   */
  save: function(discordId, system, ign) {
    return Ign.findOneAndUpdate(
      { discordId, system },
      { $set: { ign } },
      { upsert: true, new: true }
    ).exec();
  }
};
