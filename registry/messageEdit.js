const u = require("./regUtils");

module.exports = u.msgContext()
  .setName("Edit Message")
  .setContexts(u.contexts.Guild)
  .toJSON();