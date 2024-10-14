// @ts-check
const u = require("./regUtils");

// GENERAL FUNCTIONS
const role = (action = "add") => new u.string()
  .setName(action === 'equip' ? "color" : "role")
  .setDescription(`The role to ${action}`)
  .setRequired(action === 'equip' ? false : true)
  .setAutocomplete(true);
/**
 *
 * @param {number | null} num
 * @param {boolean} [req]
 * @returns
 */
const user = (num, req = false) => new u.user()
  .setName(`${num ?? "user"}`)
  .setDescription(`User ${num ?? ""}`)
  .setRequired(num === 1 || req);


// ROLE COMMANDS
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


// BANK COMMANDS
const award = new u.sub()
  .setName("award")
  .setDescription("Award ember to a member for the house cup.")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Who do you want to award?")
      .setRequired(true)
  )
  .addIntegerOption(
    new u.int()
      .setName("amount")
      .setDescription("How many ember do you want to give them?")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(10000)
  )
  .addStringOption(
    new u.string()
      .setName("reason")
      .setDescription("But... why?")
      .setRequired(false)
  );


// TOURNAMENT COMMANDS
const champion = new u.sub()
  .setName("champions")
  .setDescription("Declare tournament champions!")
  .addStringOption(
    new u.string()
      .setName("tournament")
      .setDescription("The name of the tournament")
      .setRequired(true)
  )
  .addUserOption(user(1))
  .addUserOption(user(2))
  .addUserOption(user(3))
  .addUserOption(user(4))
  .addUserOption(user(5))
  .addUserOption(user(6));

const reset = new u.sub()
  .setName("reset")
  .setDescription("Reset the Tournament Participant role");

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
  .addSubcommandGroup(
    new u.subGroup()
      .setName("bank")
      .setDescription("Interact with currency")
      .addSubcommand(award)
  )
  .addSubcommandGroup(
    new u.subGroup()
      .setName("tournament")
      .setDescription("Manage tournaments")
      .addSubcommand(champion)
      .addSubcommand(reset)
  )
  .setDMPermission(false)
  .setDefaultMemberPermissions(u.privateCommand)
  .toJSON();