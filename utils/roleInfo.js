// @ts-check
const { GuildMember } = require("discord.js");
const u = require("./utils");

/**
 * @typedef {{baseId: string, inherited: string[], colorId: string }[]} equipRoles
 */
/**
 * @param {GuildMember} member
 * @param {equipRoles} equipRoles
 */
function getInventory(member, equipRoles) {
  return u.perms.calc(member, ["mgr"]) ? equipRoles : equipRoles.filter(r => member.roles.cache.hasAny(r.baseId, ...r.inherited));
}

/**
 * @param {GuildMember} member
 * @param {equipRoles} equipRoles
 * @param {string | null} role
 */
async function equip(member, equipRoles, role) {
  const allColors = equipRoles.map(r => r.colorId);
  const available = getInventory(member, equipRoles);
  if (!role) {
    await member.roles.remove(allColors.filter(c => member.roles.cache.has(c)));
    return true;
  }
  if (!member.guild.roles.cache.has(role)) return false;
  const color = available.find(a => a.baseId === role);
  if (!color) return false;
  if (member.roles.cache.has(color.colorId)) return true;
  await member.roles.remove(allColors.filter(c => member.roles.cache.has(c) && c !== color.colorId));
  await member.roles.add(color.colorId);
  return true;
}

module.exports = {
  getInventory,
  equip
};