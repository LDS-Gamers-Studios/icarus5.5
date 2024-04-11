// @ts-check
const u = require("./regUtils");

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

const refresh = new u.sub()
  .setName("refresh")
  .setDescription("Creates a new voice channel if none are available");

module.exports = new u.cmd()
  .setName("voice")
  .setDescription("Voice channel options")
  .addSubcommand(lock)
  .addSubcommand(unlock)
  .addSubcommand(streamlock)
  .addSubcommand(refresh)
  .setDMPermission(false)
  .toJSON();