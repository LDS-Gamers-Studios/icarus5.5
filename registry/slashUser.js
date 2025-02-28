// @ts-check
const u = require("./regUtils");

const info = new u.sub()
  .setName("info")
  .setDescription("Get information on a user, like their ID, join date, and roles.")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to get information for. (Defaults to yourself)")
      .setRequired(false)
  );

const profile = new u.sub()
.setName("profile")
.setDescription("Get the profile card of a LDSG member.")
.addUserOption(
  new u.user()
    .setName("user")
    .setDescription("The user to get information for. (Defaults to yourself)")
    .setRequired(false)
);

module.exports = new u.cmd()
  .setName("user")
  .setDescription("Member information")
  .addSubcommand(info)
  .addSubcommand(profile)
  .setContexts(u.contexts.Guild)
  .toJSON();