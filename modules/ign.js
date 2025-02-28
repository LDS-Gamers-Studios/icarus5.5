// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const fuzzy = require("fuzzysort");

/**
 * @typedef {import("../database/sheetTypes").IGN} IGN
 * @typedef {import("../database/controllers/ign").IGN} StoredIGN
 */

const hasLink = /(http(s?):\/\/)?(\w+\.)+\w+\//ig;

/**
 * @param {IGN & { ign: string }} ign
 */
function ignFieldMap(ign) {
  let value = ign.ign;
  if (ign.link && !hasLink.test(value)) {
    const url = ign.link.replace(/{ign}/ig, encodeURIComponent(value));
    value = `[${value}](${url})`;
  }
  if (value.length > 100) value = value.substring(0, 100) + " ...";
  return { name: ign.name, value };
}

/**
 * @param {Discord.User | Discord.GuildMember} user
 * @param {StoredIGN[]} igns
 * @param {boolean} paged
 * @returns {{ embed: Discord.EmbedBuilder, fields: Map<string, string[]>} | null}
 */
function embedsIGN(user, igns, paged) {
  if (igns.length === 0) return null;

  const metaIgns = igns
    .map(i => {
      const meta = u.db.sheets.igns.get(i.system) ?? { name: i.system, link: null, aliases: [], category: "", system: i.system };
      return { ...meta, ign: i.ign };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const embed = u.embed({ author: user });
  if (igns.length > 1) embed.setTitle(`IGNs for ${u.escapeText(user.displayName)}`);

  if (paged === true) {
    const fields = new Map(
      metaIgns.map(i => {
        const form = ignFieldMap(i);
        return [form.name, [form.value]];
      })
    );

    return { embed, fields };
  }

  metaIgns.map(i => {
    const ign = ignFieldMap(i);
    embed.addFields({ name: ign[0], value: ign[1][0], inline: true });
  });
  return { embed, fields: new Map() };
}

/** @param {string | null} [system] */
function findSystem(system) {
  if (!system) return undefined;
  system = system.toLowerCase();
  return u.db.sheets.igns.find(i => i.name.toLowerCase() === system || i.system.toLowerCase() === system || i.aliases.includes(system));
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnSet(int) {
  const system = int.options.getString("system", true);
  const ign = int.options.getString("ign", true);

  const found = findSystem(system);
  if (!found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const newIgn = await u.db.ign.save(int.user.id, found.system, ign);
  if (!newIgn) return int.editReply("Sorry, I had a problem saving your IGN.");

  const embed = embedsIGN(int.user, [newIgn], false);
  return int.editReply({ content: "Your IGN has been saved!", embeds: embed ? [embed.embed] : undefined });
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
  if (setting) {
    await u.db.user.bdayMsgs(int.user.id, en[setting]);
  }

  if (month && day) {
    const newIgn = await u.db.ign.save(int.user.id, system.system, `${month} ${day}`);
    if (!newIgn) return int.editReply("Sorry, I ran into a problem saving your IGN.").then(u.clean);

    let str = "I've set your birthday!";
    switch (setting) {
      case en[0]: str += " I won't send you any DMs though."; break;
      case en[1]: str += " I'll also send you a few DMs on your special day."; break;
      case en[2]: str += " I'll also send you plenty of DMs on your special day."; break;
      default: break;
    }

    const embed = embedsIGN(int.user, [newIgn], false);
    return int.editReply({ content: str, embeds: embed ? [embed.embed] : undefined }).then(u.clean);

  } else if (month || day) {
    return int.editReply("You need to give me a month and day!").then(u.clean);
  }
  return int.editReply("I've updated your birthday DM setting!").then(u.clean);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnRemove(int) {
  const system = int.options.getString("system", true);
  const found = findSystem(system);
  if (!found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const deleted = await u.db.ign.delete(int.user.id, found.system);
  if (!deleted) return int.editReply(`You didn't have an IGN saved for ${found.name}.`);

  return int.editReply(`Your ${found.name} IGN has been removed.`);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnView(int) {
  const system = int.options.getString("system");

  const target = int.options.getUser("target") ?? int.user;
  const member = int.client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(target.id);
  if (!member) return int.editReply("I couldn't find that user! They might not be in the server.").then(u.clean);

  const found = findSystem(system);
  if (system && !found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const igns = await u.db.ign.findMany(int.user.id, found?.system);
  const embeds = embedsIGN(member, igns, true);

  if (!embeds) {
    if (found) return int.editReply(`Looks like ${target} doesn't have an IGN saved for ${found.name} yet.`);
    return int.editReply(`Looks like ${target} doesn't have any IGNs saved yet!`);
  }

  const processedEmbeds = u.pagedEmbedFields(embeds.embed, embeds.fields, true).map(e => ({ embeds: [e] }));
  return u.manyInteractions(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnWhoPlays(int) {
  const system = int.options.getString("system", true);
  const found = findSystem(system);
  if (!found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const members = int.client.guilds.cache.get(u.sf.ldsg)?.members.cache;
  if (!members) return int.editReply("I got lost trying to find LDSG. Sorry!");

  const igns = await u.db.ign.findMany([...(members.keys() ?? [])], found.system);
  if (igns.length === 0) return int.editReply("Looks like nobody has an IGN set for that yet.").then(u.clean);

  const withName = igns.map(ig => ({ ...ig, name: members.get(ig.discordId)?.displayName ?? "Unknown User" }));

  // sort
  if (system === "birthday") withName.sort((a, b) => new Date(a.ign).valueOf() - new Date(b.ign).valueOf());
  else withName.sort((a, b) => a.name.localeCompare(b.name));

  const lines = withName.map(ign => {
    const withoutLinkEmbed = ign.ign.startsWith("http") ? `<${ign.ign}>` : ign.ign;
    return `· **${u.escapeText(ign.name)}**: ${u.escapeText(withoutLinkEmbed)}`;
  });


  const embed = u.embed().setTitle(`IGNs for ${found.name}`);
  const processedEmbeds = u.pagedEmbedsDescription(embed, lines).map(e => ({ embeds: [e] }));
  return u.manyInteractions(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnWhoIs(int) {
  const inputIgn = int.options.getString("ign", true);
  const inputSystem = int.options.getString("system");

  const found = findSystem(inputSystem);
  if (inputSystem && !found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const members = int.client.guilds.cache.get(u.sf.ldsg)?.members.cache;
  if (!members) return int.editReply("I got lost trying to find LDSG. Sorry!");

  const igns = await u.db.ign.findMany([...members.keys()], inputSystem);
  const lines = [];

  // do a fuzzy search
  for (const i of igns) {
    const pass = fuzzy.single(inputIgn, i.ign);
    const member = members.get(i.discordId);

    if (pass && pass.score > 0.4 && member) {
      const system = (found ?? u.db.sheets.igns.get(lines[0].system))?.name ?? lines[0].system;
      const ign = pass.highlight("**", "**");
      const withoutLinkEmbed = ign.startsWith("http") ? `<${ign}>` : ign;
      lines.push({
        name: member.displayName,
        ign,
        score: pass.score,
        system,
        str: `· **${u.escapeText(member.displayName)}**: ${u.escapeText(withoutLinkEmbed)}`
      });
    }
  }

  lines.sort((a, b) => b.score - a.score);

  if (lines.length === 0) return int.editReply("I couldn't find anyone by that name.");

  if (lines.length === 1) {
    return int.editReply(`\`${inputIgn}\` is ${lines[0].name}'s IGN for ${lines[0].system}`);
  }

  const embed = u.embed().setTitle(`IGN Lookup for "${inputIgn}"`);

  const processedEmbeds = u.pagedEmbedsDescription(embed, lines.map(l => l.str)).map(e => ({ embeds: [e] }));
  return u.manyInteractions(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
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