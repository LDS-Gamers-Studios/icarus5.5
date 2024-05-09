// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const config = require("../config/config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");
const c = require("../utils/modCommon");

/** @type {Discord.Collection<string, Discord.Role>} */
let roles = new u.Collection();

/** @type {Discord.Collection<string, {colorId: string, baseId: string, inherited: string[]}>} */
let eRoles = new u.Collection();

/**
 * @param {Discord.GuildMember} member
 * @param {string} id
*/
const hasRole = (member, id) => member?.roles.cache.has(id);

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function slashRoleAdd(int, give = true) {
  await int.deferReply({ ephemeral: true });
  const pres = give ? "add" : "remove";
  const input = int.options.getString("role", true);
  const admin = u.perms.calc(int.member, ["mgr"]);
  const role = (admin ? int.guild.roles.cache.filter(r => !r.name.match(/(--)|(\^\^)|(~~)/)) : roles).find(r => r.name.toLowerCase() == input.toLowerCase());
  if (role) {
    try {
      if (hasRole(int.member, role.id) == give) return int.editReply(`You ${give ? "already" : "don't"} have the ${role} role!`);
      give ? await int.member?.roles.add(role) : await int.member?.roles.remove(role);
      return int.editReply(`Successfully ${pres}ed the ${role} role`);
    } catch (e) {
      return int.editReply(`Failed to ${pres} the ${role} role`);
    }
  } else {
    return admin ? int.editReply(`I couldn't find the ${input} role`) : int.editReply(`You didn't give me a valid role`);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleWhoHas(int) {
  try {
    const ephemeral = int.channel?.id == u.sf.channels.general;
    await int.deferReply({ ephemeral });
    const role = int.options.getRole("role", true);
    const members = role.members.map(m => m.displayName).sort();
    if (members.length == 0) return await int.editReply("I couldn't find any members with that role. :shrug:");
    const chunks = [];
    let activeChunk = "";
    for (const member of members) {
      if (activeChunk.length + member.length + 2 > 1900) {
        chunks.push(activeChunk);
        activeChunk = "";
      }
      activeChunk += `${member}\n`;
    }
    chunks.push(activeChunk);
    for (const chunk of chunks) {
      if (chunk == chunks[0]) await int.editReply(`Members with the ${role} role: ${role.members.size}\n\`\`\`\n${chunk}\n\`\`\``);
      else await int.followUp({ content: `Continued:\n\`\`\`${chunk}\`\`\``, ephemeral });
    }
  } catch (error) { u.errorHandler(error, int); }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function slashRoleGive(int, give = true) {
  try {
    await int.deferReply({ ephemeral: true });
    const recipient = int.options.getMember("user");
    if (!recipient) return int.editReply("I couldn't find that user!");
    const response = await c.assignRole(int, recipient, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}
/** @param {Discord.GuildMember} member */
function getInventory(member) {
  return u.perms.isMgmt(member) ? eRoles : eRoles.filter(r => member.roles.cache.hasAny(r.baseId, ...r.inherited));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleInventory(int) {
  try {
    const member = int.member;
    const inventory = getInventory(member);
    const inv = int.guild.roles.cache
      .filter(r => inventory.has(r.id))
      .sort((a, b) => b.comparePositionTo(a))
      .map(r => r);
    const embed = u.embed({ author: member })
      .setTitle("Equippable Color Inventory")
      .setDescription(`Equip a color role with </role equip:${u.sf.commands.slashRole}>\n\n${inv.join("\n")}`);
    if (inv.length == 0) int.reply({ content: "You don't have any colors in your inventory!", ephemeral: true });
    else int.reply({ embeds: [embed], ephemeral: int.channel?.id != u.sf.channels.botspam });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleEquip(int) {
  try {
    await int.deferReply({ ephemeral: true });
    const allColors = eRoles.map(r => r.colorId);
    const available = getInventory(int.member);
    const input = int.options.getString("color");
    if (!input) {
      await int.member.roles.remove(allColors);
      return int.editReply("Color removed!");
    }
    const real = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    const role = int.guild.roles.cache.find(r => r.id == eRoles.find(a => a.baseId == real?.id || a.colorId == real?.id)?.colorId);
    if (!role) {
      return int.editReply(`Sorry, that's not a color role on this server. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
    } else if (!available.has(role.id)) {
      return int.editReply(`Sorry, you don't have that color in your inventory. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
    } else {
      await int.member.roles.remove(allColors);
      await int.member.roles.add(role.id);
      int.editReply("Color applied!");
    }
  } catch (e) { u.errorHandler(e, int); }
}

async function setRoles() {
  try {
    const filterBlank = (input) => input != "" && input != null && input != undefined;
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("LDSG is unavailable");
    const doc = new GoogleSpreadsheet(config.google.sheets.config);
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    /** @type {{RoleId: string}[]} */
    // @ts-ignore
    const rows = await doc.sheetsByTitle["Opt-In Roles"].getRows();
    roles.clear();
    const ids = rows.map(r => r["RoleId"]).filter(filterBlank);
    roles = ldsg?.roles.cache.filter(r => ids.includes(r.id)) ?? new u.Collection();
    /** @type {{"Color Role ID": string, "Base Role ID": string, "Lower Roles": string}[]} */
    // @ts-ignore
    const equipRoles = await doc.sheetsByTitle["Roles"].getRows();

    const mappedEquips = equipRoles
      .filter(r => r != null && r != undefined && r["Base Role ID"] && r["Color Role ID"])
      .map(r => ({ colorId: r["Color Role ID"], baseId: r["Base Role ID"], inherited: r["Lower Roles"]?.split(" ").filter(filterBlank) ?? [] }));
    eRoles = new u.Collection(mappedEquips.map(e => [e.colorId, e]));
  } catch (e) { u.errorHandler(e, "Load Color & Equip Roles"); }
}

const Module = new Augur.Module();

Module.addInteraction({
  name: "role",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashRole,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
    case "add": return await slashRoleAdd(interaction);
    case "remove": return await slashRoleAdd(interaction, false);
    case "give": return slashRoleGive(interaction);
    case "take": return slashRoleGive(interaction, false);
    case "inventory": return slashRoleInventory(interaction);
    case "equip": return slashRoleEquip(interaction);
    case "whohas": return slashRoleWhoHas(interaction);
    }
  },
  autocomplete: (interaction) => {
    const option = interaction.options.getFocused(true);
    const sub = interaction.options.getSubcommand(true);
    if (option.name == 'role') {
      if (sub == "give" || sub == "take") {
        if (!u.perms.calc(interaction.member, ["team", "mod", "mgr"])) return;
        const values = ["Adulting", "Bookworm", "LDSG Lady"];
        return interaction.respond(values.map(v => ({ name: v, value: v })));
      }
      const adding = sub == "add";
      const values = (u.perms.isAdmin(interaction.member) ? interaction.guild.roles.cache : roles)
        .filter(r => r.name.toLowerCase().includes(option.value.toLowerCase()) && // relevant
          r.comparePositionTo(u.sf.roles.icarus) < 0 && // able to be given
          !r.managed && r.id != u.sf.ldsg && // not managed or @everyone
          !r.name.match(/(--)|(~~)|(\^\^)/) && // not a role separator
          (adding != interaction.member.roles.cache.has(r.id)) // not a role that would fail
        )
        .sort((a, b) => b.comparePositionTo(a))
        .map(r => r.name);
      return interaction.respond(u.unique(values).slice(0, 24).map(v => ({ name: v, value: v })));
    } else if (option.name == 'color') {
      const inventory = getInventory(interaction.member);
      const available = interaction.guild.roles.cache
        .filter(r => inventory.has(r.id) && r.name.toLowerCase().includes(option.value.toLowerCase()))
        .sort((a, b) => b.comparePositionTo(a))
        .map((n) => n.name);
      return interaction.respond(u.unique(available).slice(0, 24).map(v => ({ name: v, value: v })));
    }
  }
})
.setInit((reloaded) => {
  if (!reloaded) return;
  setRoles();
})
.setUnload(() => true)
.addEvent("ready", async () => {
  await setRoles();
});

module.exports = Module;