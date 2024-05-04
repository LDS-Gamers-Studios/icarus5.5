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
  .setDescription("[STAFF] Give someone a role")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to receive the role")
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
    .setName("role")
    .setDescription("The role to give")
    .setRequired(true)
    .setAutocomplete(true)
  );

const take = new u.sub()
.setName("take")
.setDescription("[STAFF] Take a role from someone")
.addUserOption(
  new u.user()
    .setName("user")
    .setDescription("The user to take the role from")
    .setRequired(true)
)
.addStringOption(
  new u.string()
  .setName("role")
  .setDescription("The role to take")
  .setRequired(true)
  .setAutocomplete(true)
);

const inventory = new u.sub()
  .setName("inventory")
  .setDescription("View all your color roles");

const who = new u.sub()
  .setName("whohas")
  .setDescription("See who has a role")
  .addStringOption(role());

const equip = new u.sub()
  .setName("equip")
  .setDescription("Equip a color role (leave blank to remove)")
  .addStringOption(role("equip"));


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
  .setDMPermission(false)
  .toJSON();