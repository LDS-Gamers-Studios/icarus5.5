// @ts-check
const u = require("./regUtils");

const role = (action = "add") => new u.string()
  .setName(action === 'equip' ? "color" : "role")
  .setDescription(`The role to ${action}`)
  .setRequired(action === 'equip' ? false : true)
  .setAutocomplete(true);

const add = new u.sub()
  .setName("add")
  .setDescription("Add an opt-in role")
  .addStringOption(role());

const remove = new u.sub()
  .setName("remove")
  .setDescription("Remove an opt-in role")
  .addStringOption(role("remove"));

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
  // .addSubcommand(give) this is located at /team role give in team.js
  // .addSubcommand(take) this is located at /team role take in team.js
  .addSubcommand(inventory)
  .addSubcommand(who)
  .addSubcommand(equip)
  .addSubcommand(list)
  .setContexts(u.contexts.Guild)
  .toJSON();