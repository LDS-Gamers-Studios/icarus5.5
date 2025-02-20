// @ts-check
const u = require("./regUtils");

module.exports = u.userContext()
  .setName("Moderation")
  .setContexts(u.contexts.Guild)
  .toJSON();
