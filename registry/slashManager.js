// @ts-check
const u = require("./regUtils");

/**
 * @param {string} name
 * @param {boolean} [req]
 * @returns
 */
const userOp = (name, req = false) => new u.user()
  .setName(`${name ?? "user"}`)
  .setDescription(`User ${name ?? ""}`)
  .setRequired(req);

const transfer = new u.sub()
  .setName("transfer")
  .setDescription("Transfer data from a users old account to their new one")
  .addUserOption(userOp("new", true))
  .addUserOption(userOp("old", false))
  .addStringOption(
    new u.string()
      .setName("old-id")
      .setDescription("Old user ID in the case of a deleted account")
      .setRequired(false)
  );

const user = new u.subGroup()
  .setName("user")
  .setDescription("Manage users")
  .addSubcommand(transfer);

module.exports = new u.cmd()
  .setName("manager")
  .setDescription("Commands for the Discord Managers")
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.privateCommand)
  .addSubcommandGroup(user)
  .toJSON();