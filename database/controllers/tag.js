// @ts-check
const Tag = require("../models/Tag.model");

/**
 * @typedef tag
 * @prop {string} tag the tag name
 * @prop {string} [response] the tag response
 * @prop {string} [attachment] the tag file name
 * @prop {import("mongoose").Types.ObjectId} _id the id of the tag
 */

module.exports = {
  /**
   * Fetch all tags
   * @returns {Promise<tag[]>}
   */
  fetchAllTags: function() {
    return Tag.find({}, undefined, { lean: true }).exec();
  },
  /**
   * Create or modify a tag
   * @param {Omit<tag, "_id">} data tag data
   * @returns {Promise<tag | null>}
   */
  manageTag: function(data) {
    return Tag.findOneAndUpdate({ tag: data.tag }, data, { upsert: true, lean: true, new: true });
  },
  /**
   * Delete a tag
   * @param {string} tag the tag to delete
   * @returns {Promise<tag | null>}
   */
  deleteTag: function(tag) {
    return Tag.findOneAndRemove({ tag }, { new: false, lean: true }).exec();
  }
};