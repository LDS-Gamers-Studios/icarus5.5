// @ts-check
const u = require("./regUtils");

const role = (action = "add") => new u.string()
  .setName(action === 'equip' ? "color" : "role")
  .setDescription(`The role to ${action}`)
  .setRequired(action === 'equip' ? false : true)
  .setAutocomplete(true);

const give = new u.sub()
  .setName("give")
  .setDescription("Give someone a role")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to receive the role")
      .setRequired(true)
  )
  .addStringOption(role("give"));

const take = new u.sub()
.setName("take")
.setDescription("Take a role from someone")
.addUserOption(
  new u.user()
    .setName("user")
    .setDescription("The user to take the role from")
    .setRequired(true)
)
.addStringOption(role("take"));

module.exports = new u.cmd()
  .setName("team")
  .setDescription("Do team stuff. idk.")
  .addSubcommandGroup(
    new u.subGroup()
      .setName("role")
      .setDescription("Manage roles for a user.")
      .addSubcommand(give)
      .addSubcommand(take)
  )
  .setDMPermission(false)
  .setDefaultMemberPermissions(u.privateCommand)
  .toJSON();