// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const config = require("../config/config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");

const roles = new u.Collection();
let eRoles = new u.Collection();

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function roleFunc(int, give = true) {
  try {
    await int.deferReply({ ephemeral: true });
    const input = int.options.getString("role", true);
    if (u.perms.isAdmin(int.member)) {
      const member = int.guild.members.cache.find(usr => usr.id === int.user.id);
      const role = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
      if (role) {
        if (give) {
          try {
            if (member?.roles.cache.has(role.id)) return int.editReply(`You already have the ${role} role`);
            await member?.roles.add(role);
            return int.editReply(`Successfully added the ${role} role`);
          } catch (e) { return int.editReply(`Failed to add the ${role} role`); }
        }
        try {
          if (!member?.roles.cache.has(role.id)) return int.editReply(`You do not have the ${role} role`);
          await member?.roles.remove(role);
          return int.editReply(`Successfully removed the ${role} role`);
        } catch (e) { return int.editReply(`Failed to remove the ${role} role`); }
      } else { return int.editReply(`I couldn't find the ${input} role`); }
    } else if (roles.has(input.toLowerCase())) {
      const role = int.guild.roles.cache.get(roles.get(input.toLowerCase()));
      const member = await int.guild.members.fetch(int.user.id);
      if (role) {
        if (give) {
          try {
            if (member) await member.roles.add(role);
            return int.editReply(`Successfully added the ${role} role`);
          } catch (e) { return int.editReply(`Failed to add the ${role} role`); }
        }
        try {
          if (member) await member.roles.remove(role);
          return int.editReply(`Successfully removed the ${role} role`);
        } catch (e) { return int.reply(`Failed to remove the ${role} role`); }
      }
    } else {
      return int.editReply(`You didn't give me a valid role`);
    }
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function whoHas(int) {
  try {
    const input = int.options.getString("role", true);
    const role = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role) {
      if (role && role.members.size > 0) int.reply({ content: `Members with the ${role} role:\n\`\`\`\n${role.members.map(m => m.displayName).sort().join("\n")}\n\`\`\``, ephemeral: !(int.channel?.id == int.client.getTextChannel(u.sf.channels.general)?.id) });
      else int.reply({ content: "I couldn't find any members with that role. :shrug:", ephemeral: true });
    } else {
      int.reply({ content: "You need to give me a valid role to find!", ephemeral: true });
      u.clean(int);
    }
  } catch (error) { u.errorHandler(error, int); }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Boolean} give
*/
async function staffFunc(int, give = true) {
  try {
    const pres = give ? "give" : "take";
    const past = give ? "gave" : "removed";
    await int.deferReply({ ephemeral: true });
    const input = int.options.getString("role", true);
    if (!u.perms.calc(int.member, ["team", "mod", "mgr"])) return int.editReply("*Nice try!* This command is for Team+ only");
    if (!u.perms.calc(int.member, ["mod", "mgr"]) && input.toLowerCase() == "adulting") return int.editReply("This command is for Mod+ only");
    const recipient = int.options.getMember("user");
    const role = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role) {
      if (!(role.id == u.sf.roles.adulting || role.id == u.sf.roles.lady || role.id == u.sf.roles.bookworm)) {
        return int.editReply(`This command is not for the ${role} role`);
      }
      try {
        if (recipient?.roles.cache.has(role.id) && give) return int.editReply(`User already has the ${role} role`);
        if (!recipient?.roles.cache.has(role.id) && !give) return int.editReply(`User already does not have the ${role} role`);
        give ? await recipient?.roles.add(role.id) : await recipient?.roles.remove(role.id);
        int.editReply(`Successfully ${past} the ${role} role`);
        if (role.id == u.sf.roles.bookworm) return;
        const embed = u.embed({ author: recipient, color: 0x5865f2 });
        embed.setTitle(`User ${give ? "added to" : "removed from"} ${role.name}`)
          .setDescription(`${int.member} ${past} the ${role} role ${give ? "to" : "from"} ${recipient}.`);
        return int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
      } catch (e) { return int.editReply(`Failed to ${pres} the ${role} role`); }
    }
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
      .setDescription(`Equip a color role with </role equip:${u.sf.commands.slashRole}> \ne.g.  \`/role equip color:novice colors\`\n\n${inv.join("\n")}`);
    if (inv.length == 0) int.reply({ content: "You don't have any colors in your inventory!", ephemeral: true });
    else int.reply({ embeds: [embed], ephemeral: !(int.channel?.id == int.client.getTextChannel(u.sf.channels.botspam)?.id) });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function equip(int) {
  try {
    int.deferReply({ ephemeral: true });
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
      return int.editReply("Sorry, that's not a color role on this server. Check `/role inventory` to see what you can equip.");
    } else if (!available.has(role.id)) {
      return int.editReply("Sorry, you don't have that color in your inventory. Check `/role inventory` to see what you can equip.");
    } else {
      await int.member.roles.remove(allColors);
      await int.member.roles.add(role.id);
      int.editReply("Color applied!");
    }
  } catch (e) { u.errorHandler(e, int); }
}

const Module = new Augur.Module()
  .addInteraction({
    name: "role",
    guildId: u.sf.ldsg,
    onlyGuild: true,
    id: u.sf.commands.slashRole,
    process: async (interaction) => {
      if (interaction.isAutocomplete()) return;
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
      if (option.name == 'role') {
        if (interaction.options.getSubcommand(true) == "whohas") {
          const all = Module.client.guilds.cache.get(u.sf.ldsg).roles.cache.filter((n) => n?.name.toLowerCase().startsWith(option.value?.toLowerCase())).map((n) => n.name).slice(0, 24);
          return interaction.respond(u.unique(all).map(v => ({ name: v, value: v })));
        } else if (interaction.options.getSubcommand(true) == "give" || interaction.options.getSubcommand(true) == "take") {
          if (!u.perms.calc(interaction.member, ["team", "mod", "mgr"])) return;
          const values = ["Adulting", "Bookworm", "LDSG Lady"].filter(n => n?.toLowerCase().startsWith(option.value?.toLowerCase())).slice(0, 24);
          return interaction.respond(values.map(v => ({ name: v, value: v })));
        }
        const values = roles.filter((i, n) => n?.toLowerCase().startsWith(option.value?.toLowerCase())).map((i, n) => n).slice(0, 24);
        return interaction.respond(u.unique(values).map(v => ({ name: v, value: v })));
      } else if (option.name == 'color') {
        const available = Module.client.guilds.cache.get(u.sf.ldsg).roles.cache.filter(r => getInventory(interaction.member).find(a => a.id == r.id)).filter((n) => n?.name.toLowerCase().startsWith(option.value?.toLowerCase())).map((n) => n.name).slice(0, 24);
        return interaction.respond(u.unique(available).map(v => ({ name: v, value: v })));
      }
    }
  })
  .addEvent("ready", async () => {
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
      eRoles = new u.Collection(channels.map(r => [r['Color Role ID'], { id: r['Color Role ID'], baseRole: r['Base Role ID'], local: r['Local ID'], inherited: r['Lower Roles']?.split(" ") }])).filter(r => r.id != "").filter(r => r.id);
    } catch (e) { u.errorHandler(e, "Load Color & Equip Roles"); }
  });

module.exports = Module;