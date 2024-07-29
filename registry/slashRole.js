// @ts-check
const u = require("./regUtils");

const role = (action = "add") => new u.string()
  .setName(action == 'equip' ? "color" : "role")
  .setDescription(`The role to ${action}`)
  .setRequired(action == 'equip' ? false : true)
  .setAutocomplete(true);

const add = new u.sub()
  .setName("add")
  .setDescription("Add an opt-in role")
  .addStringOption(role());

const remove = new u.sub()
  .setName("remove")
  .setDescription("Remove an opt-in role")
  .addStringOption(role("remove"));

const give = new u.sub()
  .setName("give")
  .setDescription("[TEAM+] Give someone a role")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to receive the role")
      .setRequired(true)
  )
  .addStringOption(role("give"));

const take = new u.sub()
.setName("take")
.setDescription("[TEAM+] Take a role from someone")
.addUserOption(
  new u.user()
    .setName("user")
    .setDescription("The user to take the role from")
    .setRequired(true)
)
.addStringOption(role("take"));

const inventory = new u.sub()
  .setName("inventory")
  .setDescription("View all your color roles");

const who = new u.sub()
  .setName("whohas")
  .setDescription("See who has a role")
  .addRoleOption(
    new u.role()
    .setName("role")
    .setDescription("The role to check")
    .setRequired(true)
  );

const equip = new u.sub()
  .setName("equip")
  .setDescription("Equip a color role (leave blank to remove)")
  .addStringOption(role("equip"));

const list = new u.sub()
  .setName("list")
  .setDescription("Get a list of opt-in roles, including a list of ones you have.");

module.exports = new u.cmd()
  .setName("role")
  .setDescription("Add and remove self-assignable roles")
  .addSubcommand(add)
  .addSubcommand(remove)
  .addSubcommand(give)
  .addSubcommand(take)
  .addSubcommand(inventory)
  .addSubcommand(who)
  .addSubcommand(equip)
  .addSubcommand(list)
  .setDMPermission(false)
  .toJSON();