// @ts-check
const u = require("./regUtils");

const pull = new u.sub()
  .setName("fetch")
  .setDescription("Check for new emails from missionarys");

const register = new u.sub()
  .setName("register")
  .setDescription("Record a missionary's email")
  .addStringOption(
    new u.string()
      .setName("email")
      .setDescription("The missionary's email (must end in @missionary.org")
      .setRequired(true)
  )
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Who do you want to register this email to?")
      .setRequired(true)
  );

const remove = new u.sub()
  .setName("remove")
  .setDescription("Remove a missionary's email if they have one")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose email do you want to remove?")
      .setRequired(true)
  );

const check = new u.sub()
  .setName("check")
  .setDescription("Check a if someone has a registered missionary email")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose email do you want to check?")
      .setRequired(true)
  );

module.exports = new u.cmd()
  .setName("missionary")
  .setDescription("Manage missonary mail settings")
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.devMode)
  .addSubcommand(pull)
  .addSubcommand(remove)
  .addSubcommand(register)
  .addSubcommand(check)
  .toJSON();
