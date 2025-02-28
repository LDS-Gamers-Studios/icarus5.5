// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");

/** @typedef {import("../database/sheetTypes").IGN} IGN */

/**
 * @param {Discord.User | Discord.GuildMember} user
 * @param {import("../database/controllers/ign").IGN[]} igns
 */
function embedIGN(user, igns) {
  if (igns.length === 0) return null;

  const metaIgns = igns
    .map(i => {
      const meta = u.db.sheets.igns.get(i.system) ?? { name: i.system, link: null, aliases: [], category: "" };
      return { ...meta, ign: i.ign };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const embed = u.embed({ author: user });
  if (igns.length > 1) embed.setTitle(`IGNs for ${u.escapeText(user.displayName)}`);

  const hasLink = /(http(s?):\/\/)?(\w+\.)+\w+\//ig;

  for (const ign of metaIgns) {
    let value = ign.ign;
    if (ign.link && !hasLink.test(value)) {
      const url = ign.link.replace(/{ign}/ig, encodeURIComponent(value));
      value = `[${value}](${url})`;
    }
    if (value.length > 100) value = value.substring(0, 100) + " ...";
    embed.addFields({ name: ign.name, value, inline: true });
  }

  return embed;
}


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
  const system = u.db.sheets.igns.get("birthday");
  if (!system) return int.editReply("Sorry, I had a problem accessing the birthday settings.");
  const month = int.options.getString("month");
  const day = int.options.getInteger("day");
  const setting = int.options.getString("notifications");
  if (!month && !day && !setting) return int.editReply("You didn't give me anything to set!").then(u.clean);

  const en = u.db.user.BirthdayEnum;
  let str = "";
  if (setting) {
    await u.db.user.bdayMsgs(int.user.id, en[setting]);
  }

  if (month && day) {
    await u.db.ign.save(int.user.id, system.system, `${month} ${day}`);
    str += `I've set your birthday!`;
    switch (setting) {
      case en[0]: str += " I won't send you any DMs though."; break;
      case en[1]: str += " I'll also send you a few DMs on your special day."; break;
      case en[2]: str += " I'll also send you plenty of DMs on your special day."; break;
      default: break;
    }
    return int.editReply(str).then(u.clean);
  } else if (!setting) {
    return int.editReply("You need to give me a month and day!").then(u.clean);
  }
  return int.editReply("I've updated your birthday DM setting!").then(u.clean);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnRemove(int) {
  const system = int.options.getString("system", true).toLowerCase();
  const found = u.db.sheets.igns.find(i => i.name.toLowerCase() === system || i.system.toLowerCase() === system || i.aliases.includes(system));
  if (!found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const deleted = await u.db.ign.delete(int.user.id, found.system);
  if (!deleted) return int.editReply(`You didn't have an IGN saved for ${found.name}.`);
  return int.editReply(`Your ${found.name} IGN has been removed.`);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnView(int) {
  const system = int.options.getString("system")?.toLowerCase();

  const target = int.options.getUser("target") ?? int.user;
  const member = int.client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(target.id);
  if (!member) return int.editReply("I couldn't find that user! They might not be in the server.").then(u.clean);

  /** @type {IGN | undefined} */
  let found = undefined;
  if (system) {
    found = u.db.sheets.igns.find(i => i.name.toLowerCase() === system || i.system.toLowerCase() === system || i.aliases.includes(system));
    if (system && !found) return int.editReply("Sorry, I didn't recognize that IGN system.");
  }

  const igns = await u.db.ign.findMany(int.user.id, found?.system);
  const embed = embedIGN(member, igns);

  if (!embed) {
    if (found) return int.editReply(`Looks like ${target} doesn't have an IGN saved for ${found.name} yet.`);
    return int.editReply(`Looks like ${target} doesn't have any IGNs saved yet!`);
  }

  return int.editReply({ embeds: [embed] });
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