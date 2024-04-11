// @ts-check
const u = require("./regUtils");

module.exports = u.msgContext()
  .setName("Moderation")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .toJSON();
