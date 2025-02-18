// @ts-check
const u = require("./regUtils");

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
      .setMaxLength(16)
  );

const elite = new u.sub()
  .setName("elite")
  .setDescription("Elite: Dangerous information")
  .addStringOption(
    new u.string()
      .setName("info")
      .setDescription("The information to get")
      .addChoices(
        { name: "Status", value: "status" },
        { name: "Time", value: "time" },
        { name: "System", value: "system" },
        { name: "Factions", value: "factions" },
        { name: "Bodies", value: "bodies" },
        { name: "Stations", value: "stations" }
      )
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("system-name")
      .setDescription("The name of the system. Defaults to LDSG's system.")
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
  .addSubcommand(minecraft)
  .addSubcommand(playing)
  .addSubcommand(elite)
  .toJSON();
