// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const config = require("../config/config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");
const c = require("../utils/modCommon");

/** @type {Discord.Collection<string, string>} */
const roles = new u.Collection();
/** @type {Discord.Collection<string, {id: string, baseRole: string, inherited: string}>} */
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
async function roleFunc(int, give = true) {
  try {
    const pres = give ? "add" : "remove";
    const past = give ? "added" : "removed";
    await int.deferReply({ ephemeral: true });
    const input = int.options.getString("role", true);
    const admin = u.perms.isAdmin(int.member);
    const role = admin ? int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase()) : int.guild.roles.cache.get(roles.find((i, n) => n.toLowerCase() == input.toLowerCase()) ?? "");
    if (role) {
      try {
        if (hasRole(int.member, role.id) && give) return int.editReply(`You already have the ${role} role`);
        if (!hasRole(int.member, role.id) && !give) return int.editReply(`You already do not have the ${role} role`);
        give ? await int.member?.roles.add(role) : await int.member?.roles.remove(role);
        return int.editReply(`Successfully ${past} the ${role} role`);
      } catch (e) { return int.editReply(`Failed to ${pres} the ${role} role`); }
    } else { return admin ? int.editReply(`I couldn't find the ${input} role`) : int.editReply(`You didn't give me a valid role`); }
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function whoHas(int) {
  try {
    const role = int.options.getRole("role", true);
    // const role = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role.members.size > 0) int.reply({ content: `Members with the ${role} role: ${role.members.size}\n\`\`\`\n${role.members.map(m => m.displayName).sort().join("\n")}\n\`\`\``, ephemeral: int.channel?.id == u.sf.channels.general });
    else int.reply({ content: "I couldn't find any members with that role. :shrug:", ephemeral: true });
  } catch (error) { u.errorHandler(error, int); }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function staffFunc(int, give = true) {
  try {
    await int.deferReply({ ephemeral: true });
    const recipient = int.options.getMember("user");
    if (!recipient) return int.editReply("I couldn't find that user!");
    const response = await c.staffRole(int, recipient, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}
/** @param {Discord.GuildMember} member */
function getInventory(member) {
  return eRoles.filter(r => member.roles.cache.find(ro => ro.id == r.baseRole || r.inherited?.includes(ro.id)));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function inventory(int) {
  try {
    const member = int.member;
    const inv = getInventory(member).map(color => int.guild.roles.cache.get(color.id)).sort((a, b) => b.comparePositionTo(a));
    const embed = u.embed({ author: member })
      .setTitle("Equippable Color Inventory")
      .setDescription(`Equip a color role with </role equip:${u.sf.commands.slashRole}>\n\n${inv.join("\n")}`);
    if (inv.length == 0) int.reply({ content: "You don't have any colors in your inventory!", ephemeral: true });
    else int.reply({ embeds: [embed], ephemeral: int.channel?.id != u.sf.channels.botspam });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function equip(int) {
  try {
    await int.deferReply({ ephemeral: true });
    const allColors = eRoles.map(r => r.id);
    const available = getInventory(int.member);
    const input = int.options.getString("color");
    if (!input) {
      await int.member.roles.remove(allColors);
      return int.editReply("Color removed!");
    }
    const real = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    const role = int.guild.roles.cache.find(r => r.id == eRoles.find(a => a.baseRole == real?.id || a.id == real?.id)?.id);
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
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const doc = new GoogleSpreadsheet(config.google.sheets.config);
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-ignore
    const rows = await doc.sheetsByTitle["Opt-In Roles"].getRows();
    roles.clear();
    for (const row of rows) {
      roles.set(ldsg?.roles.cache.find(r => r.id == row["RoleID"])?.name, row["RoleID"]);
    }
    // @ts-ignore
    const channels = await doc.sheetsByTitle["Roles"].getRows();
    eRoles = new u.Collection(channels.map(r => [r['Color Role ID'], { id: r['Color Role ID'], baseRole: r['Base Role ID'], inherited: r['Lower Roles']?.split(" ") }])).filter(r => r.id != "").filter(r => r.id);
  } catch (e) { u.errorHandler(e, "Load Color & Equip Roles"); }
}

const Module = new Augur.Module()
  .addInteraction({
    name: "role",
    guildId: u.sf.ldsg,
    onlyGuild: true,
    id: u.sf.commands.slashRole,
    process: async (interaction) => {
      switch (interaction.options.getSubcommand(true)) {
      case "add": return await roleFunc(interaction);
      case "remove": return await roleFunc(interaction, false);
      case "give": return staffFunc(interaction);
      case "take": return staffFunc(interaction, false);
      case "inventory": return inventory(interaction);
      case "equip": return equip(interaction);
      case "whohas": return whoHas(interaction);
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
        const values = u.perms.isAdmin(interaction.member) ? Module.client.guilds.cache.get(u.sf.ldsg).roles.cache.filter((n) => n?.name.toLowerCase().startsWith(option.value?.toLowerCase())).map((n) => n.name).slice(0, 24) : roles.filter((i, n) => n?.toLowerCase().startsWith(option.value?.toLowerCase())).map((i, n) => n).slice(0, 24);
        return interaction.respond(u.unique(values).map(v => ({ name: v, value: v })));
      } else if (option.name == 'color') {
        const available = Module.client.guilds.cache.get(u.sf.ldsg).roles.cache.filter(r => getInventory(interaction.member).find(a => a.id == r.id)).filter((n) => n?.name.toLowerCase().startsWith(option.value?.toLowerCase())).map((n) => n.name).slice(0, 24);
        return interaction.respond(u.unique(available).map(v => ({ name: v, value: v })));
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
