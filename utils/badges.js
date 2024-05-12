// @ts-check

// Gets the badges that belong to the user based on a list of roles.

const u = require("../utils/utils"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  gs = require("google-spreadsheet"),
  fs = require("fs");

/**
 * Gets all badge data from the Google Sheet.
 * @returns {Promise<Map>}
 */
async function getBadgeData() {
  if (!config.google.sheets.config) {
    console.log("No Sheets ID");
    return new Map();
  }
  const doc = new gs.GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-ignore sheets stuff
    const roles = await doc.sheetsByTitle["Roles"].getRows();

    const badgeMap = new Map();

    for (const role of roles) {
      // Only add to the map if they have a role ID...
      if (!role["Base Role ID"] || role["Base Role ID"] == '') continue;
      // ...and if they have a badge listed...
      if (!role["Badge"] || role["Badge"] == "") continue;
      // ...and if the badge path is valid.
      if (!fs.existsSync(`./media/badges/${role["Badge"]}.png`)) continue;

      badgeMap.set(role["Base Role ID"], {
        title: role["Role Reference"],
        image: `${role["Badge"]}.png`,
        // if there are lower roles, split them, and then remove the one at the end that's just an empty string.
        overrides: (role["Lower Roles"] ? role["Lower Roles"].split(" ").filter((x) => x) : null)
      });

    }
    // @ts-ignore once again
    const optInRoles = await doc.sheetsByTitle["Opt-In Roles"].getRows();
    for (const role of optInRoles) {
      if (!role["RoleID"]) continue;
      if (!role["Badge"]) continue;
      if (!fs.existsSync(`./media/badges/${role["Badge"]}.png`)) continue;

      badgeMap.set(role["RoleID"], {
        title: role["Role Tag"],
        image: `${role["Badge"]}.png`,
        overrides: null
      });

    }

    return badgeMap;

  } catch (e) {
    u.errorHandler(e, "Badges Load");
    return new Map();
  }
}

/** Based on the list of roles inserted, return the list of badge objects that the member
 * should have on their profile card.
 *
 * @param {Discord.Collection<string, Discord.Role>} roles The roles that the member has.
 * @returns {Promise<Array<{title: string, image: string, overrides: string[]?}>>} Badge objects used by the makeProfileCard function.
 */
async function getBadges(roles) {
  const badges = await getBadgeData();
  const overrides = [];
  const userBadges = [];
  Array.from(roles.values())
    .sort((a, b) => b.position - a.position)
    .forEach((role => {
      // If the role isn't overridden, there's a badge for it, and the user doesn't already have 10 badges,
      // then add it to the badges list.
      if (!overrides.includes(role.id) && badges.has(role.id) && (userBadges.length < 10)) {
        userBadges.push(badges.get(role.id));
        if (badges.get(role.id).overrides) { badges.get(role.id).overrides.forEach(override => overrides.push(override)); }
      }
    }));
  return userBadges;
}

module.exports = getBadges;