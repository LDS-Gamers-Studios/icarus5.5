// @ts-check
const u = require('./regUtils');
const Discord = require("discord.js");

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
  .setDescription("[ADMIN] Reloads a module. Good for loading in small fixes.")
  .addStringOption(
    new u.string()
      .setName("module")
      .setDescription("What module should be reloaded? Leave blank to reload all.")
      .setRequired(false)
      .setAutocomplete(true)
  );

const sheets = new u.sub()
  .setName("sheets")
  .setDescription("[ADMIN] Reloads a google sheet. Good for loading in small changes.")
  .addStringOption(
    new u.string()
      .setName("sheet-name")
      .setDescription("What sheet should be reloaded? Leave blank to reload all.")
      .setRequired(false)
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

const register = new u.sub()
  .setName("register")
  .setDescription("[ADMIN] Register slash commands");

const status = new u.sub()
  .setName("status")
  .setDescription("Set the bot status/activity")
  .addStringOption(
    new u.string()
      .setName("status")
      .setDescription("Set the online status")
      .setChoices(
        { name: "Online", value: "online" },
        { name: "Idle", value: "idle" },
        { name: "Invisible (offline)", value: "invisible" },
        { name: "Do Not Disturb", value: "dnd" }
      )
      .setRequired(false)
  )
  .addStringOption(
    new u.string()
      .setName("activity")
      .setDescription("The name of the bot's activity")
      .setRequired(false)
  )
  .addStringOption(
    new u.string()
      .setName("type")
      .setDescription("The activity type")
      .setChoices(...Object.keys(Discord.ActivityType).filter(t => Number.isNaN(parseInt(t))).map(t => ({ name: t, value: t })))
      .setRequired(false)
  )
  .addStringOption(
    new u.string()
      .setName("url")
      .setDescription("The URL for the activity")
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
  .addSubcommand(register)
  .addSubcommand(status)
  .addSubcommand(sheets)
  .setContexts(u.contexts.Guild)
  .setDefaultMemberPermissions(u.privateCommand)
  .toJSON();