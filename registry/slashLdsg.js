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

const code = new u.sub()
  .setName("code")
  .setDescription("Our Code of Conduct");

const donate = new u.sub()
  .setName("donate")
  .setDescription("Help us out!");

const site = new u.sub()
  .setName("site")
  .setDescription("Check out our website!");

const store = new u.sub()
  .setName("store")
  .setDescription("Get the link to our merch store!");

const youtube = new u.sub()
  .setName("socials")
  .setDescription("Check out our other social platforms!");

const invite = new u.sub()
  .setName("invite")
  .setDescription("Get the link to invite someone to our Discord server!");

module.exports = new u.cmd()
  .setName("ldsg")
  .setDescription("Information related to LDSG as a whole")
  .addSubcommand(members)
  .addSubcommand(suggest)
  .addSubcommand(code)
  .addSubcommand(donate)
  .addSubcommand(site)
  .addSubcommand(store)
  .addSubcommand(youtube)
  .addSubcommand(invite)
  .toJSON();