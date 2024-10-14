// @ts-check

const OAuth = require("../models/OAuth.model");

module.exports = {
  get: (id) => {
    return OAuth.findOne({ id }, undefined, { lean: true });
  },
  update: (id, access, refresh) => {
    return OAuth.findOneAndUpdate({ id }, { accessToken: access, refreshToken: refresh }, { lean: true, upsert: true });
  }
};