// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  banners = require('../data/banners.json'),
  fs = require('fs'),
  path = require('path'),
  Module = new Augur.Module();

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCakeday(int) {
  const dateInput = int.options.getString("date");
  if (dateInput) {
    const date = new Date(dateInput);
    date.setHours(10);
    if (isNaN(date.valueOf())) return int.editReply("Sorry, but I couldn't understand that date.");
    int.client.moduleManager.shared.get("cake.js")?.shared.cakeDays(date);
  } else {
    int.client.moduleManager.shared.get("cake.js")?.shared.cakeDays();
  }
  return int.editReply("Cakeday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runBirthday(int) {
  const dateInput = int.options.getString("date", true);
  if (dateInput) {
    const date = new Date(dateInput);
    date.setHours(10);
    if (isNaN(date.valueOf())) return int.editReply("Sorry, but I couldn't understand that date.");
    int.client.moduleManager.shared.get("cake.js")?.shared.birthDays(date);
  } else {
    int.client.moduleManager.shared.get("cake.js")?.shared.birthDays();
  }
  return int.editReply("Birthday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCelebrate(int) {
  // @ts-ignore
  int.client.moduleManager.shared.get("cake.js")?.shared.celebrate(true);
  return int.editReply("Celebrate run!");
}

/** @param {string} [holiday] */
async function setBanner(holiday) {
  const date = new Date();
  const month = date.getMonth();
  const day = date.getDate();

  // should look for the banners in banners.json
  const banner = banners.find(b => holiday ? b.file === holiday.toLowerCase() : b.month === month && b.day === day);
  if (!banner) return "I couldn't find that file."; // end function here if there's not a banner

  const bannerPath = `media/banners/${banner.file}.png`;

  const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) {
    u.errorHandler(new Error("LDSG is unavailable. (Banner Set)"));
    return null;
  }

  // notify management if setting fails
  try {
    await ldsg.setBanner(bannerPath);
  } catch (error) {
    if (holiday) return "I couldn't set the banner.";
    Module.client.getTextChannel(u.sf.channels.team.logistics)?.send({
      content: `Failed to set banner, please do this manually.`,
      files: [bannerPath]
    });
  }

  return "I set the banner!";
}

Module.addInteraction({
  name: "management",
  id: u.sf.commands.slashManagement,
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ flags: ["Ephemeral"] });
    switch (subcommand) {
      case "celebrate": return runCelebrate(int);
      case "cakeday": return runCakeday(int);
      case "birthday": return runBirthday(int);
      case "banner": {
        const response = await setBanner(int.options.getString("file", true));
        if (response) int.editReply(response);
        break;
      }
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused();
    const files = fs.readdirSync(path.resolve(__dirname + "/../media/banners"))
      .filter(file => file.endsWith(".png") && file.includes(option))
      .map(f => f.substring(0, f.length - 4));
    int.respond(files.slice(0, 24).map(f => ({ name: f, value: f })));
  }
})
.setClockwork(() =>
  setInterval(() => setBanner(), 24 * 60 * 60_000)
);

module.exports = Module;
