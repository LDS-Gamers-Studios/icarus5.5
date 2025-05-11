// @ts-check
const { GuildMember } = require("discord.js");
const u = require("./utils");

/**
 * @typedef {{baseId: string, inherited: string[], colorId: string }[]} equipRoles
 */
/**
 * Get the roles that a given member can equip
 * @param {GuildMember} member
 */
function getInventory(member, override = true) {
  const equipRoles = u.db.sheets.roles.equip;
  if (override && u.perms.calc(member, ["mgmt"])) return equipRoles;
  return equipRoles.filter(r => member.roles.cache.hasAny(r.base.id, ...r.parents));
}

/**
 * null = no role, true = success, false = not equipable
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

  /** @type {(import("../database/sheetTypes").Role & { color: import("discord.js").Role }) | undefined} */
  let role;
  if (baseId) {
    role = u.db.sheets.roles.equip.get(baseId);
  } else if (baseName) {
    role = u.db.sheets.roles.equip.find(r => r.base.name.toLowerCase() === baseName.toLowerCase());
  }

  // role doesn't exist
  if (!role) return null;

  // role isn't in their inventory
  if (!inventory.has(role.base.id)) return false;

  // nothing changed
  if (member.roles.cache.has(role.color.id)) return true;

  // swap colors
  const removal = allColors.filter(c => c !== role.color.id);
  if (removal.length > 0) await member.roles.remove(removal);
  await member.roles.add(role.color.id);
  return true;
}

module.exports = {
  getInventory,
  equip
};