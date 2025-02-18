// @ts-check
const u = require("./regUtils");

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

const minecraft = new u.sub()
  .setName("minecraft-skin")
  .setDescription("Get a picture of someone's Minecraft skin")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("The Discord user to search for")
  )
  .addStringOption(
    new u.string()
      .setName("username")
      .setDescription("The username of the Minecraft player")
  );

const elite = new u.sub()
  .setName("elite")
  .setDescription("Elite: Dangerous information")
  .addStringOption(
    new u.string()
      .setName("info")
      .setDescription("The information to get")
      .addChoices(
        {
          "name": "Status",
          "value": "status"
        },
        {
          "name": "Time",
          "value": "time"
        },
        {
          "name": "System",
          "value": "system"
        },
        {
          "name": "Factions",
          "value": "factions"
        },
        {
          "name": "Bodies",
          "value": "bodies"
        },
        {
          "name": "Stations",
          "value": "stations"
        }
      )
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("system-name")
      .setDescription("The name of the system (needed for all but time and status)")
  );

const playing = new u.sub()
    .setName("playing")
    .setDescription("Find who is playing a game in the server, or list all games being played.")
    .addStringOption(
      new u.string()
        .setName("game")
        .setDescription("The game to search for (leave blank for a list of all games being played)")
    );

module.exports = new u.cmd()
  .setName("game")
  .setDescription("Get information on games")
  .setDMPermission(false)
  .addSubcommand(destiny)
  .addSubcommand(minecraft)
  .addSubcommand(playing)
  .addSubcommand(elite)
  .toJSON();
