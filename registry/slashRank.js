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
.addStringOption(
  new u.string()
    .setName("status")
    .setDescription("How do you want to track XP? (leave blank to see status)")
    .setChoices(
      { name: "Track + level up notifications", value: "FULL" },
      { name: "Track without notifications", value: "SILENT" },
      { name: "No tracking", value: "OFF" }
    )
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
  .setContexts(u.contexts.Guild)
  .addSubcommand(leaderboard)
  .addSubcommand(track)
  .addSubcommand(view)
  .toJSON();
