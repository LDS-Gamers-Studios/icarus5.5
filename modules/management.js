// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  cake = require('./cake'),
  p = require("../utils/perms");

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCakeday(int) {
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const date = new Date(`${month} ${day} ${new Date().getFullYear()}`);
  date.setHours(10);
  if (isNaN(date.valueOf())) return int.editReply("I'm not sure how, but that date didn't work...");
  // @ts-expect-error we're doing janky stuff here :)
  cake.unload(date, "cake");
  return int.editReply("Cakeday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runBirthday(int) {
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const date = new Date(`${month} ${day} ${new Date().getFullYear()}`);
  date.setHours(10);
  if (isNaN(date.valueOf())) return int.editReply("I'm not sure how, but that date didn't work...");
  // @ts-expect-error we're doing janky stuff here :)
  cake.unload(date, "bday");
  return int.editReply("Birthday run!");
}

const Module = new Augur.Module()
.addInteraction({
  name: "management",
  id: u.sf.commands.slashManagement,
  onlyGuild: true,
  permissions: (int) => p.isMgmt(int.member),
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ ephemeral: true });
    switch (subcommand) {
    case "cakeday": return runCakeday(int);
    case "birthday": return runBirthday(int);
    }
  }
});

module.exports = Module;