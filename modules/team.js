// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const c = require("../utils/modCommon");

/**
 * @typedef {"team"|"mod"|"mgr"|"mgmt"} perms
 * @type {{role: Discord.Role, permissions: perms}[]}
 */
let teamAddRoles;

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamRoleGive(int, give = true) {
  try {
    await int.deferReply({ ephemeral: true });
    const recipient = int.options.getMember("user");
    if (!recipient) return int.editReply("I couldn't find that user!");
    const input = int.options.getString("role", true);
    const role = teamAddRoles.find(r => r.role.name.toLowerCase() === input.toLowerCase());
    if (!role) return int.editReply("I couldn't find that role!");
    if (!u.perms.calc(int.member, [role.permissions])) return int.editReply(`You don't have the right permissions to ${give ? "give" : "take"} this role.`);
    const response = await c.assignRole(int, recipient, role.role, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}


const Module = new Augur.Module()
.addInteraction({ id: u.sf.commands.slashTeam,
  onlyGuild: true,
  permissions: int => u.perms.calc(int.member, ["team", "mgr"]),
  process: (int) => {
    switch (int.options.getSubcommand()) {
      case "give": return slashTeamRoleGive(int, true);
      case "take": return slashTeamRoleGive(int, false);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused(true);
    const sub = int.options.getSubcommand(true);
    if (["give", "take"].includes(sub) && option.name === "role") {
      const withPerms = teamAddRoles.filter(r => {
        if (option.value && !r.role.name.toLowerCase().includes(option.value.toLowerCase())) return;
        /** @type {("mgr"|"mod"|"team")[]} */
        const permArr = ['mgr'];
        if (r.permissions === 'mod') permArr.push("mod");
        if (['team', 'mod'].includes(r.permissions)) permArr.push("team");
        return u.perms.calc(int.member, permArr);
      }).sort((a, b) => b.role.comparePositionTo(a.role)).map(r => r.role.name);
      return int.respond(withPerms.map(r => ({ name: r, value: r })));
    }
  }
})
.setInit(() => {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("LDSG is unavailable");
    // @ts-expect-error trust. (as long as its right in the sheet lol)
    teamAddRoles = u.db.sheets.roles.filter(f => f.type === 'Team Assign').map(r => {
      const role = ldsg.roles.cache.get(r.base);
      if (!role) throw new Error(`Missing Role for Team Assign ID ${r.base}`);
      return { role, permissions: r.level };
    });
  } catch (error) {
    u.errorHandler(error, "Load Team Givable Roles");
  }
});

module.exports = Module;