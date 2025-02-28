// @ts-check
const { GuildMember } = require("discord.js");
const u = require("./utils");

/**
 * @typedef {{baseId: string, inherited: string[], colorId: string }[]} equipRoles
 */
/**
 * @param {GuildMember} member
 */
function getInventory(member, override = true) {
  const equipRoles = u.db.sheets.roles.equip;
  if (override && u.perms.calc(member, ["mgr"])) return equipRoles;
  return equipRoles.filter(r => member.roles.cache.hasAny(r.base.id, ...r.parents));
}

/**
 * @param {GuildMember} member
 * @param {string | null} baseName
 * @param {string} [baseId]
 */
async function equip(member, baseName, baseId) {
  const allColors = u.db.sheets.roles.equip.map(r => r.color.id).filter(r => member.roles.cache.has(r));
  const inventory = getInventory(member);

  if (!baseName && !baseId) {
    await member.roles.remove(allColors);
    return true;
  }
  // role can't be equipped
  if (!baseName) return null;
  if (baseId ? !u.db.sheets.roles.equip.get(baseId) : !u.db.sheets.roles.equip.find(r => r.base.name.toLowerCase() === baseName.toLowerCase())) {
    return null;
  }
  const colorRole = baseId ? inventory.get(baseId) : inventory.find(r => r.base.name.toLowerCase() === baseName.toLowerCase());
  // role isn't in their inventory
  if (!colorRole) return false;

  // nothing changed
  if (member.roles.cache.has(colorRole.color.id)) return true;

  const removal = allColors.filter(c => c !== colorRole.color.id);
  if (removal.length > 0) await member.roles.remove(removal);
  await member.roles.add(colorRole.color.id);
  return true;
}

module.exports = {
  getInventory,
  equip
};