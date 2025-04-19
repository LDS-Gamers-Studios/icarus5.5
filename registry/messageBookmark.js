// @ts-check
const u = require("./regUtils");

module.exports = u.msgContext()
  .setName("Bookmark")
  .setContexts(u.contexts.Guild, u.contexts.PrivateChannel, u.contexts.BotDM)
  .toJSON();
