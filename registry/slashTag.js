// @ts-check
const u = require("./regUtils");


const create = new u.sub()
  .setName("create")
  .setDescription("Create a new tag.")
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("The name of the tag.")
      .setRequired(true)
  )
  .addAttachmentOption(
    new u.attachment()
      .setName("attachment")
      .setDescription("A file to add to the tag.")
      .setRequired(false)
  );

const modify = new u.sub()
  .setName("modify")
  .setDescription("Set a new value for an existing tag.")
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("The name of the tag.")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addAttachmentOption(
    new u.attachment()
      .setName("attachment")
      .setDescription("A file to upload with the message.")
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
  .addSubcommand(create)
  .addSubcommand(modify)
  .addSubcommand(del)
  .addSubcommand(variables)
  .addSubcommand(value)
  .setDMPermission(false)
  .setDefaultMemberPermissions(u.devMode)
  .toJSON();