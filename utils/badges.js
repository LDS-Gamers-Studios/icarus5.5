// @ts-check

// Gets the badges that belong to the user based on a list of roles.

const Discord = require("discord.js"),
  fs = require("fs"),
  u = require("./utils");

/**
 * @typedef Badge
 * @prop {string} image
 * @prop {string[]} overrides
 */

/** @type {Discord.Collection<string, Badge>} */
const badges = new Discord.Collection();
/**
 * Gets all badge data from the Google Sheet.
 */
function getBadgeData() {
  const roles = u.db.sheets.roles;
  const optInRoles = u.db.sheets.optRoles;

  try {
    for (const [id, role] of roles) {
      // Only add to the map...
      if (!role.badge || // if they have a badge listed
        !fs.existsSync(`./site/backend/public/badges/${role.badge}.png`) // and if the badge path is valid
      ) continue;

      badges.set(id, {
        image: `${role.badge}.png`,
        // if there are lower roles, split them, and then remove the one at the end that's just an empty string.
        overrides: role.parents
      });

    }

    for (const [id, role] of optInRoles) {
      // See above for documentation of what this statement means
      if (!role.badge || !fs.existsSync(`./site/backend/public/badges/${role.badge}.png`)) continue;

      badges.set(id, {
        image: `${role.badge}.png`,
        overrides: []
      });
    }
  } catch (e) {
    u.errorHandler(e, "Get Badge Data");
  }
  return badges;
}

/** Based on the list of roles inserted, return the list of badge objects that the member
 * should have on their profile card.
 *
 * @param {Discord.Collection<string, Discord.Role>} roles The roles that the member has.
 * @returns {(Badge & {name: string})[]} Badge objects used by the makeProfileCard function.
 */
function getBadges(roles) {
  const guild = roles.first()?.guild;
  return badges.filter((b, id) => roles.hasAny(id) && !roles.hasAny(...b.overrides)).map((r, id) => {
    const name = guild?.roles.cache.get(id)?.name ?? "";
    return { ...r, name };
  });
}

module.exports = { getBadges, getBadgeData };
