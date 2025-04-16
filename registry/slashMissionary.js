// @ts-check
const u = require("./regUtils");

const send = new u.sub()
  .setName("send")
  .setDescription("sends a registered missionary an email.")
  .addStringOption(
    new u.string()
      .setName("missionary")
      .setDescription("the registered missionary that you wish to send an email to.")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(
    new u.string()
      .setName("content")
      .setDescription("the content of the email you wish to send them.")
      .setRequired(true)
  );

const pull = new u.sub()
.setName("pull")
.setDescription("pull any new emails received from missionarys");

const register = new u.sub()
  .setName("register")
  .setDescription("register a missionary email")
  .addStringOption(
    new u.string()
      .setName("email")
      .setDescription("the missionary email you wish to register (must end in @missionary.org")
      .setRequired(true)
  )
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Who do you wish to register this email to? (needs mod for other than yourself)")
      .setRequired(false)
  );

const remove = new u.sub()
  .setName("remove")
  .setDescription("un-register a persons missionary email if they have one")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose email do you wish to un-register (needs mod for other than yourself)")
      .setRequired(false)
  );
const check = new u.sub()
  .setName("check")
  .setDescription("check a if a person has a registered missionary email")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose email do you wish to check (needs mod for other than yourself)")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .setName("missionary")
  .setDescription("send and get emails from missionmail@ldsgamers.com")
  .setContexts(u.contexts.Guild)
  .addSubcommand(send)
  .addSubcommand(pull)
  .addSubcommand(remove)
  .addSubcommand(register)
  .addSubcommand(check)
  .toJSON();
