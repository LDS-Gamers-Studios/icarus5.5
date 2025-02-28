// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnSet(int) {
  const system = int.options.getString("system", true).toLowerCase();
  const ign = int.options.getString("ign", true);
  const found = u.db.sheets.igns.find(i => i.name.toLowerCase() === system || i.system.toLowerCase() === system || i.aliases.includes(system));
  if (!found) return int.editReply("Sorry, I didn't recognize that IGN system.");
  await u.db.ign.save(int.user.id, found.system, ign);
  return int.editReply("Your IGN has been saved!");
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnBirthday(int) {
  return int;
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnRemove(int) {
  return int;
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnView(int) {
  return int;
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnWhoPlays(int) {
  return int;
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnWhoIs(int) {
  return int;
}

const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashIgn,
  process: async (int) => {
    await int.deferReply({ flags: int.channelId !== u.sf.channels.botSpam ? ["Ephemeral"] : [] });
    switch (int.options.getSubcommand(true)) {
      case "set": return slashIgnSet(int);
      case "birthday": return slashIgnBirthday(int);
      case "remove": return slashIgnRemove(int);
      case "view": return slashIgnView(int);
      case "whoplays": return slashIgnWhoPlays(int);
      case "whois": return slashIgnWhoIs(int);
      default: u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  }
});


module.exports = Module;