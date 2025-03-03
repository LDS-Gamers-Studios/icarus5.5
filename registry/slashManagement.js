// @ts-check
const u = require('./regUtils');

const date = new u.string()
.setName("date")
.setDescription("The date to run it for");

const cakeday = new u.sub()
  .setName("cakeday")
  .setDescription("Run cakeday (tenure) for a specific Date")
  .addStringOption(date);

const birthday = new u.sub()
  .setName("birthday")
  .setDescription("Run birthday for a specific Date")
  .addStringOption(date)
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Run birthdays for someone specific")
  );

const celebrate = new u.sub()
  .setName("celebrate")
  .setDescription("Run birthday and cakeday celebrations");

const banner = new u.sub()
  .setName("banner")
  .setDescription("Set a server banner")
  .addStringOption(
    new u.string()
      .setName("file")
      .setDescription("The banner to set")
      .setRequired(true)
      .setAutocomplete(true)
  );


const team = new u.sub()
  .setName("promote")
  .setDescription("Promote a member to team")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to promote")
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
    .setName("position")
    .setDescription("The position to promote the user to")
    .setRequired(true)
    .setAutocomplete(true)
  )
  .addStringOption(
    new u.string()
    .setName("reason")
    .setDescription("The reason to be sent with the welcome message to the team chat")
  );

module.exports = new u.cmd()
  .setName("management")
  .setDescription("Management Commands")
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.devMode)
  .addSubcommand(celebrate)
  .addSubcommand(cakeday)
  .addSubcommand(banner)
  .addSubcommand(birthday)
  .addSubcommand(team)
  .toJSON();