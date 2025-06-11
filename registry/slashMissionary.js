// @ts-check
const u = require("./regUtils");

const pull = new u.sub()
  .setName("fetch")
  .setDescription("Check for new emails from missionarys");

const register = new u.sub()
  .setName("register")
  .setDescription("Record a missionary's email")
  .addUserOption(
    new u.user()
    .setName("user")
    .setDescription("Who do you want to register this email to?")
    .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("email")
      .setDescription("The missionary's email (must end in @missionary.org")
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

const list = new u.sub()
  .setName("list")
  .setDescription("Get a list of users with registered missionary emails");

module.exports = new u.cmd()
  .setName("missionary")
  .setDescription("Manage missonary mail settings")
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.privateCommand)
  .addSubcommand(pull)
  .addSubcommand(register)
  .addSubcommand(remove)
  .addSubcommand(list)
  .toJSON();
