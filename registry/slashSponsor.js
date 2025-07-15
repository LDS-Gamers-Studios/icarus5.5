// @ts-check
const u = require("./regUtils");


const invite = new u.sub()
  .setName("invite")
  .setDescription("Invite someone to your Pro Sponsor channel!")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to INVITE to your sponsor channel")
      .setRequired(true)
  );

const uninvite = new u.sub()
  .setName("uninvite")
  .setDescription("Remove someone from your Pro Sponsor channel :(")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to REMOVE from your sponsor channel")
      .setRequired(true)
  );


module.exports = new u.cmd()
  .setName("sponsor")
  .setDescription("Manage Pro Sponsor benefits")
  .addSubcommand(invite)
  .addSubcommand(uninvite)
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.privateCommand)
  .toJSON();