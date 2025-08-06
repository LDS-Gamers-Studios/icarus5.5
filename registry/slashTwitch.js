const u = require("./regUtils");

const extralife = new u.sub()
  .setName("extralife-team")
  .setDescription("Get info on this year's Extra Life team!");

const live = new u.sub()
  .setName("live")
  .setDescription("See who's live in the server.");

const approve = new u.sub()
  .setName("application")
  .setDescription("Apply to become an Approved LDSG Streamer");

module.exports = new u.cmd()
  .setName("twitch")
  .setDescription("Get info on our Twitch team!")
  .addSubcommand(extralife)
  .addSubcommand(live)
  .addSubcommand(approve)
  .setContexts(u.contexts.Guild);