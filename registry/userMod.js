// @ts-check
const u = require("./regUtils");

module.exports = u.userContext()
  .setName("Moderation")
  .setDMPermission(false)
  .toJSON();
