// @ts-check
const u = require("./regUtils");

/**
 *
 * @param {number | null} num
 * @param {boolean} [req]
 * @returns
 */
const user = (num, req = false) => new u.user()
  .setName(`${num ?? "user"}`)
  .setDescription(`User ${num ?? ""}`)
  .setRequired(num == 1 || req);

const list = new u.sub()
  .setName("list")
  .setDescription("Find upcoming LDSG tournaments.");

const champion = new u.sub()
  .setName("champion")
  .setDescription("[TEAM] Declare an LDSG Champion!")
  .addStringOption(
    new u.string()
      .setName("tourney-name")
      .setDescription("The name of the tournament")
      .setRequired(true)
  )
  .addUserOption(user(1))
  .addUserOption(user(2))
  .addUserOption(user(3))
  .addUserOption(user(4))
  .addUserOption(user(5))
  .addUserOption(user(6));

const participant = new u.sub()
    .setName("participant")
    .setDescription("[TEAM] Add or remove someone from the Tournament Access role")
    .addUserOption(user(null, true))
    .addBooleanOption(
      new u.bool()
        .setName("remove")
        .setDescription("Whether or not to remove the role (defaults to false)")
        .setRequired(false)
    )
    .addBooleanOption(
      new u.bool()
        .setName("remove-all")
        .setDescription("[DANGER] Removes the tournament role from all users")
        .setRequired(false)
    );

module.exports = new u.cmd()
  .setName("tournament")
  .setDescription("Get or update information on tournaments in the server.")
  .addSubcommand(list)
  .addSubcommand(champion)
  .addSubcommand(participant)
  .setDMPermission(false)
  .toJSON();