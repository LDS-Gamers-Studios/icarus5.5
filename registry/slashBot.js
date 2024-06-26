// @ts-check
const u = require('./regUtils');

const gotobed = new u.sub()
  .setName("gotobed")
  .setDescription("[ADMIN] Restarts the bot.");

const ping = new u.sub()
  .setName("ping")
  .setDescription("Gets the current total ping time for the bot.");

const pull = new u.sub()
  .setName("pull")
  .setDescription("[OWNER] Pull bot updates from Git.");

const pulse = new u.sub()
  .setName("pulse")
  .setDescription("Get current information about the bot's current health and uptime.");

const reload = new u.sub()
  .setName("reload")
  .setDescription("[ADMIN] Reloads one or more modules. Good for loading in small fixes.")
  .addStringOption(
    new u.string()
      .setName("module")
      .setDescription("What module should be reloaded? Leave blank to reload all.")
      .setRequired(false)
      .setAutocomplete(true)
  );

const getid = new u.sub()
  .setName("getid")
  .setDescription("Get the ID of anything in the server.")
  .addMentionableOption(
    new u.mentionable()
      .setName("mentionable")
      .setDescription("Get a user or role ID")
      .setRequired(false)
  )
  .addChannelOption(
    new u.channel()
      .setName("channel")
      .setDescription("Get a channel ID")
      .setRequired(false)
  )
  .addStringOption(
    new u.string()
      .setName("emoji")
      .setDescription("Get an emoji ID")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .setName("bot")
  .setDescription("Control the bot! Some actions are limited based on role.")
  .addSubcommand(gotobed)
  .addSubcommand(ping)
  .addSubcommand(pull)
  .addSubcommand(pulse)
  .addSubcommand(reload)
  .addSubcommand(getid)
  .setDMPermission(false)
  .setDefaultMemberPermissions(u.devMode)
  .toJSON();