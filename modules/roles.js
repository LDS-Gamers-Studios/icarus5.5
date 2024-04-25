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
    if (!input) return;
    if (p.isAdmin(int.member)) {
      const member = ldsg?.members.cache.find(usr => usr.id === int.user.id);
      const role = ldsg?.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
      if (role) {
        try {
          if (member?.roles.cache.find(r => r.id == role.id)) return int.reply({ content: `You already have the ${role.name.toLowerCase()} role` });
          await member?.roles.add(role);
          int.reply({ content: `Successfully added the ${role.name} role` });
        } catch (e) {
          int.reply({ content: `Failed to add the ${role.name} role` });
        }
      } else { int.reply({ content: `I couldn't find the ${input} role` }); }
    } else if (roles.has(input.toLowerCase())) {
      const role = ldsg.roles.cache.get(roles.get(input.toLowerCase()));
      const member = await ldsg.members.fetch(int.user.id);
      if (member) await member.roles.add(role);
      int.reply({ content: `Successfully added the ${role.name} role` });
    } else {
      int.reply({ content: `you didn't give me a valid role to apply.` });
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
      case "add": return addRole(interaction);
      case "give": return ;
      case "equip": return ;
      case "inventory": return ;
      case "remove": return ;
      case "whohas": return ;
      case "take": return ;
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