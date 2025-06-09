// @ts-check

// Gets the badges that belong to the user based on a list of roles.

const Discord = require("discord.js"),
  config = require("../config/config.json"),
  fs = require("fs");

/**
 * @typedef Badge
 * @prop {string} image
 * @prop {string[]} overrides
 * @prop {string} lore
 */

/** @type {Discord.Collection<string, Badge>} */
const badges = new Discord.Collection();
/**
 * Gets all badge data from the Google Sheet.
 * @param {typeof import("../database/sheets").data.optRoles} optRoles
 * @param {typeof import("../database/sheets").data.roles} roles
 */
function setBadgeData(optRoles, roles) {
  badges.clear();
  for (const [id, role] of roles.all) {
    // Only add to the map...
    if (!role.badge || // if they have a badge listed
      !fs.existsSync(`${config.badgePath}/${role.badge}.png`) // and if the badge path is valid
    ) continue;

    badges.set(id, {
      image: `${role.badge}.png`,
      // roles that have a higher level badge than this one
      overrides: role.parents.filter(r => roles.all.get(r)?.badge),
      lore: role.badgeLore || ""
    });
  }

  for (const [id, role] of optRoles) {
    // See above for documentation of what this statement means
    if (!role.badge || !fs.existsSync(`${config.badgePath}/${role.badge}.png`)) continue;

    badges.set(id, {
      image: `${role.badge}.png`,
      lore: role.badgeLore || "",
      overrides: []
    });
  }
}

/** Based on the list of roles inserted, return the list of badge objects that the member
 * should have on their profile card.
 *
 * @param {Discord.Collection<string, Discord.Role>} roles The roles that the member has.
 * @returns {(Badge & {name: string})[]} Badge objects used by the makeProfileCard function.
 */
function getBadges(roles) {
  const guild = roles.first()?.guild;
  return badges.filter((b, id) => roles.has(id) && !roles.hasAny(...b.overrides)).map((r, id) => {
    const name = guild?.roles.cache.get(id)?.name ?? "";
    return { ...r, name };
  });
}

module.exports = { getBadges, setBadgeData };
