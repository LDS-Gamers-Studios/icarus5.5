// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  roleInfo = require("../utils/roleInfo"),
  u = require("../utils/utils");

const Module = new Augur.Module();

/**
 * @param {Discord.GuildMember} member
 * @param {string} id
*/
const hasRole = (member, id) => member.roles.cache.has(id);

/**
 * @param {Discord.BaseInteraction<"cached">} int
 * @param {Discord.Role} role
 */
function giveableRole(int, role) {
  return !role.managed &&
    role.id !== role.guild.roles.everyone.id &&
    role.position < (int.guild.members.me?.roles.highest.position ?? 0);
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function slashRoleAdd(int, give = true) {
  await int.deferReply({ flags: ["Ephemeral"] });
  const input = int.options.getString("role", true);
  const admin = u.perms.calc(int.member, ["mgr"]);

  // role finding!
  /** @type {Discord.Role | undefined} */
  let role;
  if (admin) role = int.guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
  else role = u.db.sheets.optRoles.find(r => r.role.name.toLowerCase() === input.toLowerCase())?.role;
  if (!role) return admin ? int.editReply(`I couldn't find the ${input} role.`) : int.editReply(`You didn't give me a valid role!`);

  // validation
  if (hasRole(int.member, role.id) === give) return int.editReply(`You ${give ? "already" : "don't"} have the ${role} role!`); // prevent them from doing something useless
  if (!giveableRole(int, role)) return int.editReply(`You can't ${give ? "add" : "remove"} that role!`); // prevent adding managed or higher than bot can add

  try {
    give ? await int.member?.roles.add(role) : await int.member?.roles.remove(role);
    return int.editReply(`Successfully ${give ? "added" : "removed"} the ${role} role!`);
  } catch (e) {
    return int.editReply(`Failed to ${give ? "add" : "remove"} the ${role} role.`);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleList(int) {
  // get stored roles
  const roles = new u.Collection(u.db.sheets.optRoles.map(r => [r.role.id, r.role]));
  const [has, without] = roles.partition(r => int.member.roles.cache.has(r.id));

  const ephemeral = int.channel?.id !== u.sf.channels.botSpam;
  const embed = u.embed().setTitle("Opt-In Roles")
    .setDescription(`You can add these roles with </role add:${u.sf.commands.slashRole}> to recieve pings and gain access to certain channels\n`);

  /** @type {string[]} */
  const lines = [];
  if (has.size > 0) lines.push("**Already Have**", ...has.map(h => h.toString()));
  lines.push("\n**Available to Add**");
  if (without.size > 0) lines.push(...without.map(w => w.toString()));
  else lines.push("You already have all the opt-in roles!");

  const processedEmbeds = u.pagedEmbedsDescription(embed, lines).map(e => ({ embeds: [e] }));
  return u.manyReplies(int, processedEmbeds, ephemeral);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleWhoHas(int) {
  try {
    const ephemeral = int.channel?.id === u.sf.channels.general;
    await int.deferReply({ flags: ephemeral ? ["Ephemeral"] : undefined });

    const role = int.options.getRole("role", true);
    if (role.id === u.sf.ldsg) return int.editReply("Everyone has that role, silly!");
    if (role.id === u.sf.roles.moderation.muted && !u.perms.calc(int.member, ["mod"])) return int.editReply("I'm not gonna tell you that, ya silly goose!").then(u.clean);

    const members = role.members.map(m => m.displayName).sort();
    if (members.length === 0) return int.editReply("I couldn't find any members with that role. :shrug:");

    const embed = u.embed().setTitle(`Members with the ${role.name} role: ${role.members.size}`);
    const processedEmbeds = u.pagedEmbedsDescription(embed, members).map(e => ({ embeds: [e] }));
    return u.manyReplies(int, processedEmbeds, ephemeral);
  } catch (error) {
    u.errorHandler(error, int);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleInventory(int) {
  try {
    const member = int.member;
    const inv = roleInfo.getInventory(member)
      .sort((a, b) => b.base.comparePositionTo(a.base))
      .map(r => r.color);

    const embed = u.embed({ author: member })
      .setTitle("Equippable Color Inventory")
      .setDescription(`Equip a color role with </role equip:${u.sf.commands.slashRole}>\n\n${inv.join("\n")}`);
    if (inv.length === 0) int.reply({ content: "You don't have any colors in your inventory!", flags: ["Ephemeral"] });
    else int.reply({ embeds: [embed], flags: u.ephemeralChannel(int) });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashRoleEquip(int) {
  try {
    await int.deferReply({ flags: u.ephemeralChannel(int) });

    const input = int.options.getString("color")?.toLowerCase() || null;
    const passed = await roleInfo.equip(int.member, input);

    if (passed === null) {
      return int.editReply(`Sorry, that's not a color role in this server. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
    } else if (passed) {
      return int.editReply(`Color ${input ? "applied" : "removed"}!`);
    }
    return int.editReply(`Sorry, you don't have that color in your inventory. Check </role inventory:${u.sf.commands.slashRole}> to see what you can equip.`);
  } catch (e) { u.errorHandler(e, int); }
}

/**
 * @param {Discord.AutocompleteInteraction<"cached">} int
 * @param {Discord.Role} role
 * @param {string} input
 */
const addFilter = (int, role, input, adding = false) => {
  return role.name.toLowerCase().includes(input) &&
    giveableRole(int, role) &&
    !role.name.match(/(--)|(~~)|(\^\^)/) &&
    (adding !== int.member.roles.cache.has(role.id));
};

Module.addInteraction({
  name: "role",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashRole,
  options: { registry: "slashRole" },
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
      case "add": return slashRoleAdd(interaction);
      case "remove": return slashRoleAdd(interaction, false);
      case "list": return slashRoleList(interaction);
      case "inventory": return slashRoleInventory(interaction);
      case "equip": return slashRoleEquip(interaction);
      case "whohas": return slashRoleWhoHas(interaction);
      // case "give" || "take": located in team.js
      default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
    }
  },
  autocomplete: (interaction) => {
    const option = interaction.options.getFocused(true);
    const input = option.value.toLowerCase();
    const sub = interaction.options.getSubcommand(true);
    // /role add/remove
    if (option.name === 'role') {
      const adding = sub === "add";
      /** @type {string[]} */
      let roles;
      if (u.perms.calc(interaction.member, ["mgr"])) {
        roles = interaction.guild.roles.cache.filter(r => addFilter(interaction, r, input, adding))
          .sort((a, b) => b.comparePositionTo(a))
          .map(r => r.name);
      } else {
        roles = u.db.sheets.optRoles.filter(r => addFilter(interaction, r.role, input, adding))
          .sort((a, b) => b.role.comparePositionTo(a.role))
          .map(r => r.role.name);
      }
      return interaction.respond(u.unique(roles).slice(0, 24).map(v => ({ name: v, value: v })));
    } else if (option.name === 'color') { // /role equip
      const inventory = roleInfo.getInventory(interaction.member);
      const available = interaction.guild.roles.cache
        .filter(r => inventory.has(r.id) && r.name.toLowerCase().includes(option.value.toLowerCase()))
        .sort((a, b) => b.comparePositionTo(a))
        .map((n) => n.name);
      return interaction.respond(u.unique(available).slice(0, 24).map(v => ({ name: v, value: v })));
    }
  }
})
.addEvent("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.guild.id === u.sf.ldsg) {
    if (newMember.roles.cache.size > oldMember.roles.cache.size) {
      // Notify about new available color
      try {
        if ((Date.now() - (newMember.joinedTimestamp || 0)) > 45000) {
          if (oldMember.partial) return;
          // Check equippables if they're not auto-applying on rejoin
          const newInventory = roleInfo.getInventory(newMember, false);
          const oldInventory = roleInfo.getInventory(oldMember, false);
          const diff = newInventory.filter(r => !oldInventory.has(r.base.id));
          if (diff.size > 0) {
            newMember.send(`You have ${diff.size === 1 ? "a new color role" : "new color roles"}!\n${diff.map(r => `**${r.color.name}**`).join(", ")}\nYou can equip the colors with the \`/role equip\` command. Check \`/role inventory\` command to see what colors you can equip.`).catch(u.noop);
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
        const newInventory = roleInfo.getInventory(newMember, false);
        const oldInventory = roleInfo.getInventory(oldMember, false);
        const diff = oldInventory.filter(r => !newInventory.has(r.base.id));
        if (diff.size > 0) await newMember.roles.remove(diff.map(d => d.color));
        await u.db.user.updateRoles(newMember);
      } catch (error) {
        u.errorHandler(error, "Update Roles on Role Remove");
      }
    }
  }
});

module.exports = Module;