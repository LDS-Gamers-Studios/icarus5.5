// @ts-check
const u = require("./regUtils");

module.exports = u.msgContext()
  .setName("Moderation")
  .setContexts(u.contexts.Guild)
  .toJSON();
