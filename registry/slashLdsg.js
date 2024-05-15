// @ts-check
const u = require("./regUtils");

const members = new u.sub()
  .setName("members")
  .setDescription("Get the member count of LDSG.");

module.exports = new u.cmd()
  .setName("ldsg")
  .setDescription("Information related to LDSG as a whole")
  .addSubcommand(members)
  .toJSON();