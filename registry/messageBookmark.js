// @ts-check
const u = require("./regUtils");

module.exports = u.msgContext()
  .setName("Bookmark")
  .setDMPermission(true)
  .toJSON();
