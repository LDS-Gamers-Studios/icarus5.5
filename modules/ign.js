// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const fuzzy = require("fuzzysort");

/**
 * @typedef {import("../database/sheetTypes").IGN} IGN
 * @typedef {import("../database/controllers/ign").IGN} StoredIGN
 */

/**
 * @param {IGN & { ign: string }} ign
 */
function ignFieldMap(ign) {
  let value = ign.ign;
  if (ign.link) {
    const url = ign.link.replace(/{ign}/ig, encodeURIComponent(value));
    value = `[${value}](${url})`;
  } else {
    value = u.escapeText(value);
  }

  if (value.length > 1000) value = value.substring(0, 1000) + " ...";
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

  const populatedIgns = igns
    .map(i => {
      const details = u.db.sheets.igns.get(i.system) ?? { name: i.system, link: null, aliases: [], category: "", system: i.system };
      return { ...details, ign: i.ign };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const embed = u.embed({ author: user });
  if (igns.length > 1) embed.setTitle(`IGNs for ${u.escapeText(user.displayName)}`);

  if (paged === true) {
    const fields = new Map(
      populatedIgns.map(i => {
        const form = ignFieldMap(i);
        return [form.name, [form.value]];
      })
    );

    return { embed, fields };
  }

  populatedIgns.map(i => {
    const ign = ignFieldMap(i);
    embed.addFields({ ...ign, inline: true });
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
  if (!found || found.system === "birthday") return int.editReply("Sorry, I didn't recognize that IGN system.");

  if (/twitch.tv\//.test(ign) && found.system === "twitch") {
    return int.editReply("It looks like you've included a URL in your IGN. We take care of that on our end, so please leave it out.");
  }

  const newIgn = await u.db.ign.save(int.user.id, found.system, ign);
  if (!newIgn) return int.editReply("Sorry, I had a problem saving your IGN.");

  const embed = embedsIGN(int.user, [newIgn], false);
  let content = "Your IGN has been saved!";
  if (found.link) content += " This IGN has a link associated with it. If you included a link in your IGN, please set it without the link.";
  return int.editReply({ content, embeds: embed ? [embed.embed] : undefined });
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnBirthday(int) {
  const system = u.db.sheets.igns.get("birthday");
  if (!system) return int.editReply("Sorry, I had a problem accessing the birthday settings.");

  const month = int.options.getString("month");
  const day = int.options.getInteger("day");
  const setting = int.options.getString("notifications");

  if (!month && !day && !setting) {
    const ign = await u.db.ign.findOne(int.user.id, "birthday");
    if (ign) {
      const profile = await u.db.user.fetchUser(int.user.id);
      return int.editReply(`I have your birthday stored as \`${ign.ign}\`, with your preference set to ${(profile?.sendBdays === false) ? "no birthday DMs." : "a bunch of birthday DMs!"}`);
    }
    return int.editReply("You didn't give me anything to set!").then(u.clean);
  }


  if (setting) {
    await u.db.user.update(int.user.id, { sendBdays: setting === "FULL" });
  }

  if (month && day) {
    const newIgn = await u.db.ign.save(int.user.id, system.system, `${month} ${day}`);
    if (!newIgn) return int.editReply("Sorry, I ran into a problem saving your IGN.").then(u.clean);

    let str = "I've set your birthday!";
    switch (setting) {
      case "OFF": str += " I won't send you any DMs though."; break;
      default: str += " I'll also send you plenty of DMs on your special day."; break;
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

  const igns = await u.db.ign.findMany(member.id, found?.system);
  const embeds = embedsIGN(member, igns, true);

  if (!embeds) {
    if (found) return int.editReply(`Looks like ${target} doesn't have an IGN saved for ${found.name} yet.`);
    return int.editReply(`Looks like ${target} doesn't have any IGNs saved yet!`);
  }

  const processedEmbeds = u.pagedEmbedFields(embeds.embed, embeds.fields, true).map(e => ({ embeds: [e] }));
  return u.manyReplies(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
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

  const withName = igns.map(ig => {
    ig.ign = ignFieldMap({ ...found, ign: ig.ign }).value;

    return {
      ...ig,
      name: members.get(ig.discordId)?.displayName ?? "Unknown User"
    };
  });

  // sort
  if (system === "birthday") withName.sort((a, b) => new Date(a.ign).valueOf() - new Date(b.ign).valueOf());
  else withName.sort((a, b) => a.name.localeCompare(b.name));

  const lines = withName.map(ign => {
    const withoutLinkEmbed = ign.ign.startsWith("http") ? `<${ign.ign}>` : ign.ign;
    return `· **${u.escapeText(ign.name)}**: ${withoutLinkEmbed}`;
  });


  const embed = u.embed().setTitle(`IGNs for ${found.name}`);
  const processedEmbeds = u.pagedEmbedsDescription(embed, lines).map(e => ({ embeds: [e] }));
  return u.manyReplies(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashIgnWhoIs(int) {
  const inputIgn = int.options.getString("ign", true);
  const inputSystem = int.options.getString("system");

  const found = findSystem(inputSystem);
  if (inputSystem && !found) return int.editReply("Sorry, I didn't recognize that IGN system.");

  const members = int.client.guilds.cache.get(u.sf.ldsg)?.members.cache;
  if (!members) return int.editReply("I got lost trying to find LDSG. Sorry!");

  const igns = await u.db.ign.findMany([...members.keys()], found?.system);

  /** @type {Discord.Collection<string, { score: number, igns: {text: string, score: number}[] }>} */
  const lines = new u.Collection();

  // do a fuzzy search
  const results = fuzzy.go(inputIgn, igns, { keys: ["ign"], threshold: 0.4 });
  for (const res of results) {
    const ig = res.obj;
    const system = findSystem(ig.system);

    const line = lines.ensure(ig.discordId, () => ({ igns: [], score: 0 }));
    line.score += res.score;

    let ign = res[0].highlight("**", "**");

    if (system?.link) {
      const url = system.link.replace(/{ign}/ig, encodeURIComponent(ig.ign));
      ign = `[${ig.ign}](${url})`;
    }

    line.igns.push({ text: `· ${system?.name || ig.system}: ${ign}`, score: res.score });
  }

  lines.sort((a, b) => b.score - a.score);

  if (lines.size === 0) return int.editReply("I couldn't find anyone by that name.");

  const embed = u.embed().setTitle(`${found?.name ?? ""} IGN Lookup for "${inputIgn}"`);

  const mappedLines = lines.map((l, id) => {
    const names = l.igns
      .sort((a, b) => b.score - a.score)
      .map(i => i.text);

    return `${members.get(id)?.displayName ?? "Unknown User"}\n${names.join("\n")}\n`;
  });

  const processedEmbeds = u.pagedEmbedsDescription(embed, mappedLines).map(e => ({ embeds: [e] }));
  return u.manyReplies(int, processedEmbeds, int.channelId !== u.sf.channels.botSpam);
}

/** @type {Discord.Collection<string, { systems: Set<string>, expires: number }>} */
const autocompleteCache = new u.Collection();

const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashIgn,
  process: async (int) => {
    await int.deferReply({ flags: int.channelId !== u.sf.channels.botSpam ? ["Ephemeral"] : [] });
    switch (int.options.getSubcommand(true)) {
      case "set":
        autocompleteCache.delete(int.user.id); // delete cache for write actions
        return slashIgnSet(int);
      case "birthday": return slashIgnBirthday(int);
      case "remove":
        autocompleteCache.delete(int.user.id); // delete cache for write actions
        return slashIgnRemove(int);
      case "view": return slashIgnView(int);
      case "whoplays": return slashIgnWhoPlays(int);
      case "whois": return slashIgnWhoIs(int);
      default: u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: async (int) => {
    const option = int.options.getFocused(true);
    if (option.name === "system") {
      /** @type {{name: string, value: string}[]} */
      const systems = [];
      const val = option.value.toLowerCase();
      let igns = u.db.sheets.igns.map(i => i);

      // filter IGN systems they can remove. Uses a cache so that it's not calling the db every 5 seconds
      if (int.options.getSubcommand() === "remove") {
        /** @type {Set<string>} */
        let sys;
        const cache = autocompleteCache.get(int.user.id);

        if (cache && cache.expires > Date.now()) {
          sys = cache.systems;
        } else {
          const existing = await u.db.ign.findMany(int.user.id);
          sys = new Set(existing.map(e => e.system));
          autocompleteCache.set(int.user.id, { systems: sys, expires: Date.now() + 60_000 });
        }

        igns = igns.filter(i => sys.has(i.system));
      }

      for (const ign of igns) {
        if (ign.system === "birthday" && int.options.getSubcommand() === "set") continue;
        if (
          ign.system.toLowerCase().includes(val) ||
          ign.name.toLowerCase().includes(val) ||
          ign.aliases.find(a => a.includes(val))
        ) systems.push({ name: ign.name, value: ign.name });
      }
      systems.sort((a, b) => a.name.localeCompare(b.name));
      int.respond(systems.slice(0, 24));
    }
  }
});


module.exports = Module;