// @ts-check
const u = require("./regUtils");

const controls = new u.sub()
  .setName("controls")
  .setDescription("Generate a control panel for your voice channel.");

const lock = new u.sub()
  .setName("lock")
  .setDescription("Lock your voice channel")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("A user to allow in the channel")
      .setRequired(false)
  );

const unlock = new u.sub()
  .setName("unlock")
  .setDescription("Unlock your voice channel");

const streamlock = new u.sub()
  .setName("streamlock")
  .setDescription("Restrict voice activity for people joining your voice channel")
  .addUserOption(
    new u.user()
    .setName("user")
    .setDescription("A user to allow speaking and streaming permissions in the channel")
    .setRequired(false)
  );
const streamunlock = new u.sub()
  .setName("streamunlock")
  .setDescription("Unrestrict voice activity for people joining your voice channel");

const refresh = new u.sub()
  .setName("refresh")
  .setDescription("Creates a new voice channel if none are available");

const kick = new u.sub()
  .setName("kick")
  .setDescription("Kick a user from your voice channel")
  .addUserOption(
    new u.user()
    .setName("user")
    .setDescription("The user in question")
    .setRequired(true)
  );

module.exports = new u.cmd()
  .setName("voice")
  .setDescription("Voice channel options")
  .addSubcommand(controls)
  .addSubcommand(lock)
  .addSubcommand(unlock)
  .addSubcommand(streamlock)
  .addSubcommand(streamunlock)
  .addSubcommand(refresh)
  .addSubcommand(kick)
  .setContexts(u.contexts.Guild)
  .toJSON();