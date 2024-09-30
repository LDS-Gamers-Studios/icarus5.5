// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon");

const Module = new Augur.Module();

/** @type {Discord.Collection<string, Discord.Role>} */
let optRoles = new u.Collection();

/** @type {Discord.Collection<string, {color: string, base: string, parents: string[]}>} */
let equipRoles = new u.Collection();

/**
 * @typedef {"team"|"mod"|"mgr"|"mgmt"} perms
 * @type {{role: Discord.Role, permissions: perms}[]}
 * */
let teamAddRoles;
/**
 * @param {Discord.GuildMember} member
 * @param {string} id
*/
const hasRole = (member, id) => member.roles.cache.has(id);

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function slashRoleAdd(int, give = true) {
  await int.deferReply({ ephemeral: true });
  const input = int.options.getString("role", true);
  const admin = u.perms.calc(int.member, ["mgr", "botAdmin"]);
  const role = (admin ? int.guild.roles.cache.filter(r => !r.name.match(/[-^~]{2}/)) : optRoles).find(r => r.name.toLowerCase() === input.toLowerCase());
  if (!role) return admin ? int.editReply(`I couldn't find the ${input} role.`) : int.editReply(`You didn't give me a valid role!`);
  try {
    if (hasRole(int.member, role.id) === give) return int.editReply(`You ${give ? "already" : "don't"} have the ${role} role!`); // prevent them from doing something useless
    if (role.managed || role.id === role.guild.roles.everyone.id || role.position >= (int.guild.members.me?.roles.highest.position ?? 0)) return int.editReply(`You can't ${give ? "add" : "remove"} that role!`); // prevent adding managed or higher than bot can add
    give ? await int.member?.roles.add(role) : await int.member?.roles.remove(role);
    return int.editReply(`Successfully ${give ? "added" : "removed"} the ${role} role!`);
  } catch (e) {
    return int.editReply(`Failed to ${give ? "add" : "remove"} the ${role} role.`);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleList(int) {
  const ephemeral = int.channel?.id !== u.sf.channels.botspam;
  const has = int.member.roles.cache.intersect(optRoles);
  const without = optRoles.difference(has);
  const embed = u.embed().setTitle("Opt-In Roles")
    .setDescription(`You can add these roles with </role add:${u.sf.commands.slashRole}> to recieve pings and access to certain channels`);
  let lines = [];
  if (has.size > 0) lines = [ "**Already Have**\n", ...has.values()];
  lines.push("\n**Available to Add**");
  if (without.size > 0) lines = lines.concat([...without.values()]);
  else lines.push("You already have all the opt-in roles!");
  return u.pagedEmbeds(int, embed, lines, ephemeral);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleWhoHas(int) {
  try {
    const ephemeral = int.channel?.id === u.sf.channels.general;
    await int.deferReply({ ephemeral });
    const role = int.options.getRole("role", true);
    if (role.id === u.sf.ldsg) return int.editReply("Everyone has that role, silly!");
    const members = role.members.map(m => m.displayName).sort();
    if (members.length === 0) return int.editReply("I couldn't find any members with that role. :shrug:");
    return u.pagedEmbeds(int, u.embed().setTitle(`Members with the ${role.name} role: ${role.members.size}`), members, ephemeral);
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
    if (!u.perms.calc(int.member, ["team", "mod", "mgr"])) return int.editReply("*Nice try!* This command is for Team+ only.");
    if (!recipient) return int.editReply("I couldn't find that user!");
    const input = int.options.getString("role", true);
    const role = teamAddRoles.find(r => r.role.name.toLowerCase() === input.toLowerCase());
    if (!role) return int.editReply("I couldn't find that role!");
    if (!u.perms.calc(int.member, [role.permissions])) return int.editReply(`You don't have the right permissions to ${give ? "give" : "take"} this role.`);
    const response = await c.assignRole(int, recipient, role.role, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}
/** @param {Discord.GuildMember} member */
function getInventory(member, override = true) {
  if (override && u.perms.calc(member, ["mgr", "botAdmin"])) return equipRoles;
  return equipRoles.filter(r => member.roles.cache.hasAny(r.base, ...r.parents));
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
    if (inv.length === 0) int.reply({ content: "You don't have any colors in your inventory!", ephemeral: true });
    else int.reply({ embeds: [embed], ephemeral: int.channel?.id !== u.sf.channels.botspam });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleEquip(int) {
  try {
    await int.deferReply({ ephemeral: int.channel?.id !== u.sf.channels.botspam });
    const allColors = equipRoles.map(r => r.color);
    const available = getInventory(int.member);
    const input = int.options.getString("color");
    if (!input) {
      await int.member.roles.remove(allColors);
      return int.editReply("Color removed!");
    }
    const real = int.guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
    const role = int.guild.roles.cache.find(r => r.id === equipRoles.find(a => a.base === real?.id || a.color === real?.id)?.color);
    if (!role) {
      return int.editReply(`Sorry, that's not a color role on this server. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
    } else if (!available.has(role.id)) {
      return int.editReply(`Sorry, you don't have that color in your inventory. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
    }
    await int.member.roles.remove(allColors);
    await int.member.roles.add(role.id);
    int.editReply("Color applied!");
  } catch (e) { u.errorHandler(e, int); }
}

async function setRoles() {
  try {
    // get ldsg and define function
    const filterBlank = (input) => input !== "" && input !== null && input !== undefined;
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("LDSG is unavailable");
    // Get the opt in roles data
    const ids = u.db.sheets.optRoles.map(r => r.id).filter(filterBlank);
    optRoles = ldsg.roles.cache.filter(r => ids.includes(r.id));
    // Get the add and remove roles data
    const eRoles = u.db.sheets.roles;
    // @ts-expect-error trust. (as long as its right in the sheet lol)
    teamAddRoles = eRoles.filter(f => f.type === 'Team Assign').map(r => {
      const role = ldsg.roles.cache.get(r.base);
      if (!role) throw new Error(`Missing Role for Team Assign ID ${r.base}`);
      return {
        role,
        permissions: r.level
      };
    });
    equipRoles = new u.Collection(eRoles.map(e => [e.color, e]));
  } catch (e) {
    u.errorHandler(e, "Load Color & Equip Roles");
  }
}

Module.addInteraction({
  name: "role",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashRole,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
      case "add": return slashRoleAdd(interaction);
      case "remove": return slashRoleAdd(interaction, false);
      case "list": return slashRoleList(interaction);
      case "give": return slashRoleGive(interaction);
      case "take": return slashRoleGive(interaction, false);
      case "inventory": return slashRoleInventory(interaction);
      case "equip": return slashRoleEquip(interaction);
      case "whohas": return slashRoleWhoHas(interaction);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
    }
  },
  autocomplete: (interaction) => {
    const option = interaction.options.getFocused(true);
    const sub = interaction.options.getSubcommand(true);
    if (option.name === 'role') {
      if (["give", "take"].includes(sub)) {
        if (!u.perms.calc(interaction.member, ["team", "mod", "mgr"])) return;
        const withPerms = teamAddRoles.filter(r => {
          if (option.value && !r.role.name.toLowerCase().includes(option.value.toLowerCase())) return;
          /** @type {("mgr"|"mod"|"team")[]} */
          const permArr = ['mgr'];
          if (r.permissions === 'mod') permArr.push("mod");
          if (['team', 'mod'].includes(r.permissions)) permArr.push("team");
          return u.perms.calc(interaction.member, permArr);
        }).sort((a, b) => b.role.comparePositionTo(a.role)).map(r => r.role.name);
        return interaction.respond(withPerms.map(r => ({ name: r, value: r })));
      }
      const adding = sub === "add";
      const values = (u.perms.calc(interaction.member, ["mgr", "botAdmin"]) ? interaction.guild.roles.cache : optRoles)
        .filter(r => r.name.toLowerCase().includes(option.value.toLowerCase()) && // relevant
          r.comparePositionTo(u.sf.roles.icarus) < 0 && // able to be given
          !r.managed && r.id !== u.sf.ldsg && // not managed or @everyone
          !r.name.match(/(--)|(~~)|(\^\^)/) && // not a role separator
          (adding !== interaction.member.roles.cache.has(r.id)) // not a role that would fail
        )
        .sort((a, b) => b.comparePositionTo(a))
        .map(r => r.name);
      return interaction.respond(u.unique(values).slice(0, 24).map(v => ({ name: v, value: v })));
    } else if (option.name === 'color') {
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
})
.addEvent("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.guild.id === u.sf.ldsg) {
    if (newMember.roles.cache.size > oldMember.roles.cache.size) {
      // Notify about new available color
      try {
        if ((Date.now() - (newMember.joinedTimestamp || 0)) > 45000) {
          if (oldMember.partial) return;
          // Check equippables if they're not auto-applying on rejoin
          const newInventory = getInventory(newMember, false);
          const oldInventory = getInventory(oldMember, false);
          const diff = newInventory.filter(r => !oldInventory.has(r.color));
          if (diff.size > 0) {
            newMember.send(`You have ${diff.size > 1 ? "a new color role" : "new color roles"}!\n${diff.map(r => `- ${newMember.guild.roles.cache.get(r.color)?.name}`).join("\n")}!\nYou can equip the colors with the \`/role equip\` command. Check \`/role inventory\` command to see what colors you can equip.`).catch(u.noop);
          }
        }
        await u.db.user.updateRoles(newMember);
      } catch (error) {
        u.errorHandler(error, "Update Roles on Role Add");
      }
    } else if (newMember.roles.cache.size < oldMember.roles.cache.size) {
      // Remove color role when base role removed
      try {
        if (oldMember.partial) return;
        const newInventory = getInventory(newMember, false);
        const oldInventory = getInventory(oldMember, false);
        const diff = oldInventory.filter(r => !newInventory.has(r.color));
        if (diff.size > 0) await newMember.roles.remove([...diff.keys()]);
        await u.db.user.updateRoles(newMember);
      } catch (error) {
        u.errorHandler(error, "Update Roles on Role Remove");
      }
    }
  }
});

module.exports = Module;