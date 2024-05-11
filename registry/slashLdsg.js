// @ts-check
const u = require("./regUtils");

const members = new u.sub()
  .setName("members")
  .setDescription("Get the member count of LDSG.");

const spotlight = new u.sub()
  .setName("spotlight")
  .setDescription("Learn about one special LDSG member.");

module.exports = new u.cmd()
  .setName("ldsg")
  .setDescription("Information related to LDSG as a whole")
  .setDMPermission(false)
  .addSubcommand(members)
  .addSubcommand(spotlight)
  .toJSON();