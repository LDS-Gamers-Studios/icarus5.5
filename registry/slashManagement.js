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

const channelActivity = new u.sub()
  .setName("channel-activity")
  .setDescription("Get a list of inactive channels");

module.exports = new u.cmd()
  .setName("management")
  .setDescription("Management Commands")
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.devMode)
  .addSubcommand(celebrate)
  .addSubcommand(cakeday)
  .addSubcommand(banner)
  .addSubcommand(birthday)
  .addSubcommand(channelActivity)
  .toJSON();