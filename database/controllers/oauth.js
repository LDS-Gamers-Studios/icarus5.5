// @ts-check

const OAuth = require("../models/OAuth.model");

module.exports = {
  /** @param {string} id */
  get: (id) => {
    return OAuth.findOne({ id }, undefined, { lean: true });
  },
  /**
   * @param {string} id
   * @param {string} access
   * @param {string} refresh
   */
  update: (id, access, refresh) => {
    return OAuth.findOneAndUpdate({ id }, { accessToken: access, refreshToken: refresh }, { lean: true, upsert: true });
  }
};