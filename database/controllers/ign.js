// @ts-check
const Ign = require("../models/Ign.model");
/**
 * @typedef IGN
 * @prop {string} discordId
 * @prop {string} system
 * @prop {string} ign
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
   * Find a specific IGN
   * @param {string | string[]} discordId
   * @param {string} system
   * @returns {Promise<IGN | null>}
   */
  findOne: function(discordId, system) {
    return Ign.findOne({ discordId, system }, undefined, { lean: true }).exec();
  },
  /**
   * Find a list of all IGNs for a given system
   * @function getList
   * @param {string | string[]} discordId
   * @param {string} [system] Which system list to fetch
   * @returns {Promise<IGN[]>}
   */
  findMany: function(discordId, system) {
    let ids;
    let query;
    if (Array.isArray(discordId)) ids = { $in: discordId };
    else ids = discordId;
    if (system) query = { discordId: ids, system };
    else query = { discordId: ids };
    return Ign.find(query, undefined, { lean: true }).exec();
  },
  /**
   * Save a user's IGN
   * @function save
   * @param {string} discordId Which user's IGN to save
   * @param {string} system Which system IGN to save
   * @param {string} ign The IGN to save
   * @returns {Promise<IGN | null>}
   */
  save: function(discordId, system, ign) {
    return Ign.findOneAndUpdate({ discordId, system }, { ign }, { upsert: true, new: true, lean: true }).exec();
  },
  /**
   * Update a lot of IGNs at the same time
   * @param {string} discordId
   * @param {{system: string, ign?: string }[]} igns
   * @returns {Promise<number>}
   */
  saveMany: function(discordId, igns) {
    const actions = igns.map(i => {
      const filter = { discordId, system: i.system };
      if (!i.ign) return { deleteOne: { filter } };
      return {
        updateOne: { filter, update: { ign: i.ign }, upsert: true, new: true, lean: true }
      };
    });
    return Ign.bulkWrite(actions).then((i) => i.modifiedCount + i.insertedCount + i.deletedCount);
  }
};
