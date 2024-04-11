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
      .setDescription("The IGN for that system")
      .setRequired(true)
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
      .setDescription("The person to veiw (default: you)")
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
  .setDMPermission(true)
  .addSubcommand(set)
  .addSubcommand(remove)
  .addSubcommand(view)
  .addSubcommand(whoplays)
  .addSubcommand(whois)
  .toJSON();
