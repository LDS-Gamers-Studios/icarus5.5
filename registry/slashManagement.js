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

const cakeday = new u.sub()
  .setName("cakeday")
  .setDescription("Run cakeday (tenure) for a specific Date")
  .addStringOption(month)
  .addIntegerOption(
    new u.int()
      .setName("day")
      .setDescription("The day to run it for")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(31)
  );

const birthday = new u.sub()
  .setName("birthday")
  .setDescription("Run birthday for a specific Date")
  .addStringOption(month)
  .addIntegerOption(
    new u.int()
      .setName("day")
      .setDescription("The day to run it for")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(31)
  );

module.exports = new u.cmd()
  .setName("management")
  .setDescription("Management Commands")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .addSubcommand(cakeday)
  .addSubcommand(birthday)
  .toJSON();