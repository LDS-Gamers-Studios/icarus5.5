// @ts-check
const u = require("./regUtils");

const send = new u.sub()
  .setName("send")
  .setDescription("sends a registered missionary an email.")
  .addMentionableOption(
    new u.mentionable()
      .setName("missionary")
      .setDescription("the registered missionary that you wish to send mail to.")
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("content")
      .setDescription("the content of the mail you wish to send them.")
      .setRequired(true)
  );

const pull = new u.sub()
.setName("pull")
.setDescription("update any new mail received from missionarys in #missionary-emails");

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
  );;

const remove = new u.sub()
  .setName("remove")
  .setDescription("un-register a missionary email")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Whose email do you wish to un-register (needs mod for other than yourself)")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .setName("mishmail")
  .setDescription("send and get emals from ldsgmissionmail@gmail.com")
  .setContexts(u.contexts.Guild)
  .addSubcommand(send)
  .addSubcommand(pull)
  .addSubcommand(remove)
  .addSubcommand(register)
  .toJSON();
