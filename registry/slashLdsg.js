// @ts-check
const u = require("./regUtils");

const members = new u.sub()
  .setName("members")
  .setDescription("Get the member count of LDSG.");

const suggest = new u.sub()
  .setName("suggest")
  .setDescription("Send a suggestion to the LDSG team")
  .addStringOption(
    new u.string()
      .setName("suggestion")
      .setDescription("Your suggestion")
      .setRequired(true)
  );

module.exports = new u.cmd()
  .setName("ldsg")
  .setDescription("Information related to LDSG as a whole")
  .addSubcommand(members)
  .addSubcommand(suggest)
  .toJSON();