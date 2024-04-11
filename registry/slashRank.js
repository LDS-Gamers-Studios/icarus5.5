// @ts-check
const u = require("./regUtils");

const rank = new u.sub()
  .setName("rank")
  .setDescription("View the rank of a user")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user you want to get the rank of")
      .setRequired(false)
  );

const leaderboard = new u.sub()
.setName("leaderboard")
.setDescription("Shows the current leaderboard")
.addBooleanOption(
  new u.bool()
    .setName("lifetime")
    .setDescription("Show the lifetime leaderboard instead of the season")
    .setRequired(false)
);

const track = new u.sub()
.setName("track")
.setDescription("Toggle tracking XP or view your current tracking status")
.addBooleanOption(
  new u.bool()
    .setName("choice")
    .setDescription("Wheter or not you want to track XP")
    .setRequired(false)
);

module.exports = new u.cmd()
  .setName("rank")
  .setDescription("Interact with the XP system")
  .setDMPermission(false)
  .addSubcommand(rank)
  .addSubcommand(leaderboard)
  .addSubcommand(track)
  .toJSON();
