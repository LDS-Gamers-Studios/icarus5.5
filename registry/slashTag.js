// @ts-check
const u = require("./regUtils");


const set = new u.sub()
  .setName("set")
  .setDescription("Create or modify a tag. Content is entered after sending the command.")
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("The name of the tag.")
      .setRequired(true)
      .setMaxLength(20)
  )
  .addAttachmentOption(
    new u.attachment()
      .setName("attachment")
      .setDescription("A file to add to the tag.")
      .setRequired(false)
  );

const del = new u.sub()
  .setName("delete")
  .setDescription("[DANGER] Delete a tag.")
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("The name of the tag to remove.")
      .setRequired(true)
      .setAutocomplete(true)
  );

const variables = new u.sub()
  .setName("variables")
  .setDescription("Get a list of variables you can use");

const value = new u.sub()
  .setName("value")
  .setDescription("Get the raw version of a tag")
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("The name of the tag to remove.")
      .setRequired(true)
      .setAutocomplete(true)
  );


module.exports = new u.cmd()
  .setName("tag")
  .setDescription("Manage tags!")
  .addSubcommand(set)
  .addSubcommand(del)
  .addSubcommand(variables)
  .addSubcommand(value)
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.privateCommand)
  .toJSON();