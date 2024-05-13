// @ts-check
const u = require('./regUtils');

const month = new u.string()
.setName("month")
.setDescription("The month to run it for")
.setChoices(
  { name: "January", value: "Jan" },
  { name: "February", value: "Feb" },
  { name: "March", value: "Mar" },
  { name: "April", value: "Apr" },
  { name: "May", value: "May" },
  { name: "June", value: "Jun" },
  { name: "July", value: "Jul" },
  { name: "August", value: "Aug" },
  { name: "September", value: "Sept" },
  { name: "October", value: "Oct" },
  { name: "November", value: "Nov" },
  { name: "December", value: "Dec" },
)
.setRequired(true);

const day = new u.int()
.setName("day")
.setDescription("The day to run it for")
.setRequired(true)
.setMinValue(1)
.setMaxValue(31);

const cakeday = new u.sub()
  .setName("cakeday")
  .setDescription("Run cakeday (tenure) for a specific Date")
  .addStringOption(month)
  .addIntegerOption(day);

const birthday = new u.sub()
  .setName("birthday")
  .setDescription("Run birthday for a specific Date")
  .addStringOption(month)
  .addIntegerOption(day);

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
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .addSubcommand(cakeday)
  .addSubcommand(banner)
  .addSubcommand(birthday)
  .addSubcommand(team)
  .toJSON();