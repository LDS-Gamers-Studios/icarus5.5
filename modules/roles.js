// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const p = require("../utils/perms");
const config = require("../config/config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const roles = new u.Collection;
let eRoles = new u.Collection;

async function addRole(int) {
  try {
    const input = int.options.getString("role");
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (p.isAdmin(int.member)) {
      const member = ldsg?.members.cache.find(usr => usr.id === int.user.id);
      const role = ldsg?.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
      if (role) {
        try {
          if (member?.roles.cache.find(r => r.id == role.id)) return int.reply({ content: `You already have the ${role.name.toLowerCase()} role`, ephemeral: true });
          await member?.roles.add(role);
          int.reply({ content: `Successfully added the ${role.name} role`, ephemeral: true });
        } catch (e) { int.reply({ content: `Failed to add the ${role.name} role`, ephemeral: true }); }
      } else { int.reply({ content: `I couldn't find the ${input} role`, ephemeral: true }); }
    } else if (roles.has(input.toLowerCase())) {
      const role = ldsg.roles.cache.get(roles.get(input.toLowerCase()));
      const member = await ldsg.members.fetch(int.user.id);
      if (member) await member.roles.add(role);
      int.reply({ content: `Successfully added the ${role.name} role`, ephemeral: true });
    } else {
      int.reply({ content: `you didn't give me a valid role to apply.`, ephemeral: true });
    }
  } catch (error) { u.errorHandler(error, int); }
}

async function removeRole(int) {
  try {
    const input = int.options.getString("role");
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (p.isAdmin(int.member)) {
      const member = ldsg?.members.cache.find(usr => usr.id === int.user.id);
      const role = ldsg?.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
      if (role) {
        try {
          if (!member?.roles.cache.find(r => r.id == role.id)) return int.reply({ content: `You do not have the ${role.name.toLowerCase()} role`, ephemeral: true });
          await member?.roles.remove(role);
          int.reply({ content: `Successfully removed the ${role.name} role`, ephemeral: true });
        } catch (e) { int.reply({ content: `Failed to remove the ${role.name} role`, ephemeral: true }); }
      } else { int.reply({ content: `I couldn't find the ${input} role`, ephemeral: true }); }
    } else if (roles.has(input.toLowerCase())) {
      const role = ldsg.roles.cache.get(roles.get(input.toLowerCase()));
      const member = await ldsg.members.fetch(int.user.id);
      if (member) await member.roles.remove(role);
      int.reply({ content: `Successfully removed the ${role.name} role`, ephemeral: true });
    } else {
      int.reply({ content: `you didn't give me a valid role to remove.`, ephemeral: true });
    }
  } catch (error) { u.errorHandler(error, int); }
}

async function whoHas(int) {
  try {
    const input = int.options.getString("role");
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const role = ldsg.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role) {
      if (role && role.members.size > 0) int.reply({ content: `Members with the ${role.name} role:\n\`\`\`\n${role.members.map(m => m.displayName).sort().join("\n")}\n\`\`\``, split: { prepend: "```\n", append: "\n```" }, ephemeral: !(int.channel.id == int.client.getTextChannel(u.sf.channels.general).id) });
      else int.reply("I couldn't find any members with that role. :shrug:");
    } else {
      int.reply("You need to give me a valid role to find!")
        .then(u.clean(int));
    }
  } catch (error) { u.errorHandler(error, int); }
}

async function give(int) {
  try {
    const input = int.options.getString("role");
    if (!p.calc(int.member, ["team", "mod", "mgr"])) return int.reply({ content: "*Nice try!* This command is for Team+ only", ephemeral: true });
    if (!p.calc(int.member, ["mod", "mgr"]) && input.toLowerCase() == "adulting") return int.reply({ content: "This command is for Mod+ only", ephemeral: true });
    const recipient = int.options.getMember("user");
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const role = ldsg.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role) {
      switch (role.name.toLowerCase()) {
      case "adulting":
        try {
          await recipient.roles.add(u.sf.roles.adulting);
          int.reply({ content: `Successfully gave the ${role.name} role`, ephemeral: true });
          const embed = u.embed({ author: recipient, color: 0x5865f2 });
          embed.setTitle("User Added to Adulting")
            .setDescription(`${int.member} added the <@&${u.sf.roles.adulting}> role to ${recipient}.`);
          int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
        } catch (e) { int.reply({ content: `Failed to give the ${role.name} role`, ephemeral: true }); }
        break;
      case "ldsg lady":
        try {
          await recipient.roles.add(u.sf.roles.lady);
          int.reply({ content: `Successfully gave the ${role.name} role`, ephemeral: true });
          const embed = u.embed({ author: recipient, color: 0x5865f2 });
          embed.setTitle("User Added to LDSG Ladies")
            .setDescription(`${int.member} added the <@&${u.sf.roles.lady}> role to ${recipient}.`);
          int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
        } catch (e) { int.reply({ content: `Failed to give the ${role.name} role`, ephemeral: true }); }
        break;
      case "bookworm":
        try {
          await recipient.roles.add(u.sf.roles.bookworm);
          int.reply({ content: `Successfully gave the ${role.name} role`, ephemeral: true });
        } catch (e) { int.reply({ content: `Failed to give the ${role.name} role`, ephemeral: true }); }
        break;
      }
    } else {
      int.reply({ content:"You need to give me a valid role to give!", ephermeral: true });
    }
  } catch (error) { u.errorHandler(error, int); }
}

async function take(int) {
  try {
    const input = int.options.getString("role");
    if (!p.calc(int.member, ["team", "mod", "mgr"])) return int.reply({ content: "*Nice try!* This command is for Team+ only", ephemeral: true });
    if (!p.calc(int.member, ["mod", "mgr"]) && input.toLowerCase() == "adulting") return int.reply({ content: "This command is for Mod+ only", ephemeral: true });
    const recipient = int.options.getMember("user");
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const role = ldsg?.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (role) {
      switch (role.name.toLowerCase()) {
      case "adulting":
        try {
          await recipient.roles.remove(u.sf.roles.adulting);
          int.reply({ content: `Successfully removed the ${role.name} role`, ephemeral: true });
          const embed = u.embed({ author: recipient, color: 0x5865f2 });
          embed.setTitle("User Removed from Adulting")
            .setDescription(`${int.member} removed the <@&${u.sf.roles.adulting}> role from ${recipient}.`);
          int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
        } catch (e) { int.reply({ content: `Failed to take the ${role.name} role`, ephemeral: true }); }
        break;
      case "ldsg lady":
        try {
          await recipient.roles.remove(u.sf.roles.lady);
          int.reply({ content: `Successfully removed the ${role.name} role`, ephemeral: true });
          const embed = u.embed({ author: recipient, color: 0x5865f2 });
          embed.setTitle("User Removed from LDSG Ladies")
            .setDescription(`${int.member} removed the <@&${u.sf.roles.lady}> role from ${recipient}.`);
          int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
        } catch (e) { int.reply({ content: `Failed to take the ${role.name} role`, ephemeral: true }); }
        break;
      case "bookworm":
        try {
          await recipient.roles.remove(u.sf.roles.bookworm);
          int.reply({ content: `Successfully removed the ${role.name} role`, ephemeral: true });
        } catch (e) { int.reply({ content: `Failed to remove the ${role.name} role`, ephemeral: true }); }
        break;
      }
    } else {
      int.reply({ content:"You need to give me a valid role to take!", ephermeral: true });
    }
  } catch (error) { u.errorHandler(error, int); }
}

function getInventory(member) {
  return eRoles.filter(r => member.roles.cache.find(ro => ro.id == r.baseRole || r.inherited?.includes(ro.id)));
}

async function inventory(int) {
  try {
    const member = int.member;
    const inv = getInventory(member).map(color => int.guild.roles.cache.get(color.id)).sort((a, b) => b.comparePositionTo(a));
    const embed = u.embed().setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL({ size: 32 }) })
      .setTitle("Equippable Color Inventory")
      .setDescription(`Equip a color role with \`/role equip Role Name\`\ne.g. \`/role equip novice\`\n\n${inv.join("\n")}`);
    if (inv.length == 0) int.reply({ content: "You don't have any colors in your inventory!", ephemeral: true });
    else int.reply({ embeds: [embed], ephemeral: !(int.channel.id == int.client.getTextChannel(u.sf.channels.botspam).id) });
  } catch (e) { u.errorHandler(e, int); }
}

async function equip(int) {
  try {
    const allColors = eRoles.filter(r => r.id).map(r => r.id);
    const available = getInventory(int.member);
    const input = int.options.getString("color");
    if (!input) {
      await int.member.roles.remove(allColors);
      return int.reply({ content: "Color removed!", ephemeral: true });
    }
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const real = ldsg?.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    const role = ldsg?.roles.cache.find(r => r.id == eRoles.find(a => a.baseRole == real?.id || a.id == real?.id)?.id);
    if (!role) {
      return int.reply({ content: "Sorry, that's not a color role on this server. Check `/role inventory` to see what you can equip.", ephemeral: true });
    } else if (!available.has(role.id)) {
      return int.reply({ content: "Sorry, you don't have that color in your inventory. Check `/role inventory` to see what you can equip.", ephemeral: true });
    } else {
      await int.member.roles.remove(allColors);
      await int.member.roles.add(role.id);
      int.reply({ content: "Color applied!", ephemeral: true });
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
      case "add": return await addRole(interaction);
      case "give": return give(interaction);
      case "equip": return equip(interaction);
      case "inventory": return inventory(interaction);
      case "remove": return await removeRole(interaction);
      case "whohas": return whoHas(interaction);
      case "take": return take(interaction);
      }
    },
    autocomplete: (interaction) => {
      const option = interaction.options.getFocused(true);
      if (option.name == 'role') {
        if (interaction.options.getSubcommand(true) == "whohas") {
          const all = Module.client.guilds.cache.get(u.sf.ldsg).roles.cache.filter((n) => n?.name.toLowerCase().startsWith(option.value?.toLowerCase())).map((n) => n.name).slice(0, 24);
          return interaction.respond(u.unique(all).map(v => ({ name: v, value: v })));
        } else if (interaction.options.getSubcommand(true) == "give" || interaction.options.getSubcommand(true) == "take") {
          if (!p.calc(interaction.member, ["team", "mod", "mgr"])) return;
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
      eRoles = new u.Collection(channels.map(r => [r['Color Role ID'], { id: r['Color Role ID'], baseRole: r['Base Role ID'], local: r['Local ID'], inherited: r['Lower Roles']?.split(" ") }])).filter(r => r.id != "");
    } catch (e) { u.errorHandler(e, "Load Color & Equip Roles"); }
  });

module.exports = Module;