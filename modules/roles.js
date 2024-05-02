// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const p = require("../utils/perms");
const config = require("../config/config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const roles = new Map();

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
    const role = ldsg.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
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

const Module = new Augur.Module()
  .addInteraction({
    name: "role",
    id: u.sf.commands.slashRole,
    process: async (interaction) => {
      if (interaction.isAutocomplete()) return;
      switch (interaction.options.getSubcommand(true)) {
      case "add": return await addRole(interaction);
      case "give": return give(interaction);
      case "equip": return ;
      case "inventory": return ;
      case "remove": return await removeRole(interaction);
      case "whohas": return whoHas(interaction);
      case "take": return take(interaction);
      }
    }
  })
  .setInit(async () => {
    try {
      const doc = new GoogleSpreadsheet(config.google.sheets.config);
      await doc.useServiceAccountAuth(config.google.creds);
      await doc.loadInfo();
      // @ts-ignore
      const rows = await doc.sheetsByTitle["Opt-In Roles"].getRows();
      roles.clear();
      for (const row of rows) {
        roles.set(row["Role Tag"].toLowerCase(), row["RoleID"]);
      }
    } catch (error) { u.errorHandler(error, "Roles init"); }
  });

module.exports = Module;