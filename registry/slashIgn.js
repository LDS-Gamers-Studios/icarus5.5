// @ts-check
const u = require("./regUtils");

const set = new u.sub()
  .setName("set")
  .setDescription("Sets your various game system IGNs or social network names")
  .addStringOption(
    new u.string()
      .setName("system")
      .setDescription("The game, system, or social network for which you wish to set an IGN")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(
    new u.string()
      .setName("ign")
      .setDescription("The IGN for that system. Don't include a URL, I'll take care of that.")
      .setRequired(true)
  );

const birthday = new u.sub()
  .setName("birthday")
  .setDescription("Set your birthday and get Icarus alerts!")
  .addStringOption(
    new u.string()
      .setName("month")
      .setDescription("What month is your birthday in?")
      .setChoices(u.months)
  )
  .addIntegerOption(
    new u.int()
      .setName("day")
      .setDescription("What day is your birthday on?")
      .setMinValue(1)
      .setMaxValue(31)
  )
  .addStringOption(
    new u.string()
      .setName("notifications")
      .setDescription("Do you want to recieve birthday DMs?")
      .addChoices(
        { name: "Yes", value: "FULL" },
        { name: "No", value: "OFF" }
      )
  );

const remove = new u.sub()
  .setName("remove")
  .setDescription("Remove an IGN")
  .addStringOption(
    new u.string()
      .setName("system")
      .setDescription("The system you would like to remove from your profile")
      .setRequired(true)
      .setAutocomplete(true)
  );

const view = new u.sub()
  .setName("view")
  .setDescription("Shows IGN information for a given user")
  .addStringOption(
    new u.string()
      .setName("system")
      .setDescription("The system to get information about. If blank, all saved IGNs will be listed")
      .setRequired(false)
      .setAutocomplete(true)
  )
  .addUserOption(
    new u.user()
      .setName("target")
      .setDescription("The person to veiw (Default: you)")
      .setRequired(false)
  );

const whoplays = new u.sub()
  .setName("whoplays")
  .setDescription("Get a list of everyone in the server who has a given IGN system")
  .addStringOption(
    new u.string()
      .setName("system")
      .setDescription("The system you would like to list")
      .setRequired(true)
      .setAutocomplete(true)
  );

const whois = new u.sub()
  .setName("whois")
  .setDescription("Find out who a username belongs to")
  .addStringOption(
    new u.string()
      .setName("ign")
      .setDescription("The IGN you want to find")
      .setRequired(true)
      .setMinLength(3)
  )
  .addStringOption(
    new u.string()
      .setName("system")
      .setDescription("The system you would like to find them on")
      .setRequired(false)
      .setAutocomplete(true)
  );

module.exports = new u.cmd()
  .setName("ign")
  .setDescription("Save and view various game system IGNs or social network names")
  .setContexts(u.contexts.Guild, u.contexts.BotDM)
  .addSubcommand(set)
  .addSubcommand(birthday)
  .addSubcommand(remove)
  .addSubcommand(view)
  .addSubcommand(whoplays)
  .addSubcommand(whois)
  .toJSON();
