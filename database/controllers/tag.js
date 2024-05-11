// @ts-check
const Tag = require("../models/Tag.model");

/**
 * @typedef tag
 * @property {string} tag the tag name
 * @property {string} [response] the tag response
 * @property {string} [attachment] the tag file name
 */

module.exports = {
  /**
   * Fetch all tags
   * @returns {Promise<tag[]>}
   */
  fetchAllTags: async function() {
    return Tag.find({}).exec();
  },
  /**
   * Create or modify a tag
   * @param {tag} data tag data
   * @returns {Promise<tag | null>}
   */
  manageTag: async function(data) {
    return Tag.findOneAndUpdate({ tag: data.tag }, data, { upsert: true, lean: true, new: true });
  },
  /**
   * Delete a tag
   * @param {string} tag the tag to delete
   * @returns {Promise<tag | null>}
   */
  deleteTag: async function(tag) {
    return Tag.findOneAndRemove({ tag }, { new: false, lean: true }).exec();
  }
};