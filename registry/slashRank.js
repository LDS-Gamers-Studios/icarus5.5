// @ts-check
const u = require("./regUtils");

const leaderboard = new u.sub()
  .setName("leaderboard")
  .setDescription("Shows the current leaderboard.")
  .addBooleanOption(
    new u.bool()
      .setName("lifetime")
      .setDescription("Show the lifetime leaderboard instead of the season.")
      .setRequired(false)
  );

const track = new u.sub()
.setName("track")
.setDescription("Toggle tracking XP or view your current tracking status.")
.addBooleanOption(
  new u.bool()
    .setName("choice")
    .setDescription("Do you want to track XP? (leave blank to see status)")
    .setRequired(false)
);

const view = new u.sub()
  .setName("view")
  .setDescription("View someone's (or your) XP.")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose XP do you want to view?")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .setName("rank")
  .setDescription("Interact with the XP system.")
  .setDMPermission(false)
  .addSubcommand(leaderboard)
  .addSubcommand(track)
  .addSubcommand(view)
  .toJSON();
