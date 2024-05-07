// @ts-check
const u = require("./regUtils");

const chess = new u.sub()
  .setName("chess")
  .setDescription("Get Chess.com games")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The Discord user to search for")
  )
  .addStringOption(
    new u.string()
      .setName("username")
      .setDescription("The username of the Chess.com player")
  );

const destiny = new u.sub()
  .setName("destiny")
  .setDescription("[DESTINY MANAGER/ADMIN] Add or remove someone from a clan channel or the Valiant Knights role")
  .addStringOption(
    new u.string()
      .setName("action")
      .setDescription("The action to take")
      .setChoices(
        { "name": "Clan", "value": "clan" },
        { "name": "Valiant", "value": "valiant" }
      )
      .setRequired(true)
  )
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The user to add/remove")
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("clan")
      .setDescription("Required for setting a user's clan")
      .setChoices(
        {
          "name": "Spartans (PC 1)",
          "value": "spartans"
        },
        {
          "name": "Lightbreakers (PC 2)",
          "value": "lightbreakers"
        },
        {
          "name": "Paladins (PC 3)",
          "value": "paladins"
        },
        {
          "name": "Curmudgeons (PS 1)",
          "value": "curmudgeons"
        },
        {
          "name": "Guardians (XB 1)",
          "value": "guardians"
        },
        {
          "name": "Iron Lords (XB 2)",
          "value": "ironlords"
        }
      )
  )
  .addBooleanOption(
    new u.bool()
      .setName("remove")
      .setDescription("Set to true if you want to remove them from the clan/role")
  );

module.exports = new u.cmd()
  .setName("game")
  .setDescription("Get information on games")
  .setDMPermission(false)
  .addSubcommand(chess)
  .addSubcommand(destiny)
  .toJSON();
