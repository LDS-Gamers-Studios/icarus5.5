// @ts-check

// Gets the badges that belong to the user based on a list of roles.

const Discord = require("discord.js"),
  config = require("../config/config.json"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  fs = require("fs");

/**
 * @typedef Badge
 * @prop {string} title
 * @prop {string} image
 * @prop {string[]} overrides
 */

/** @type {Discord.Collection<string, Badge>} */
const badges = new Discord.Collection();
/**
 * Gets all badge data from the Google Sheet.
 */
async function getBadgeData() {
  if (!config.google.sheets.config) {
    console.log("No Sheets ID");
    return badges;
  }
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-expect-error sheets stuff
    const roles = await doc.sheetsByTitle["Roles"].getRows();

    for (const role of roles) {
      // Only add to the map...
      if (!role["Base Role ID"] || // if they have a role ID
        !role["Badge"] || // if they have a badge listed
        !fs.existsSync(`./media/badges/${role["Badge"]}.png`) // and if the badge path is valid
      ) continue;

      badges.set(role["Base Role ID"], {
        title: role["Role Reference"],
        image: `${role["Badge"]}.png`,
        // if there are lower roles, split them, and then remove the one at the end that's just an empty string.
        overrides: role["Parent Roles"]?.split(" ").filter((x) => x && x != " ") ?? []
      });

    }
    // @ts-ignore once again
    const optInRoles = await doc.sheetsByTitle["Opt-In Roles"].getRows();
    for (const role of optInRoles) {
      // See above for documentation of what this statement means
      if (!role["RoleID"] || !role["Badge"] || !fs.existsSync(`./media/badges/${role["Badge"]}.png`)) continue;

      badges.set(role["RoleID"], {
        title: role["Role Tag"],
        image: `${role["Badge"]}.png`,
        overrides: []
      });
    }
  } catch (e) {
    console.log(e.name);
  }
  return badges;
}

/** Based on the list of roles inserted, return the list of badge objects that the member
 * should have on their profile card.
 *
 * @param {Discord.Collection<string, Discord.Role>} roles The roles that the member has.
 * @returns {Badge[]} Badge objects used by the makeProfileCard function.
 */
function getBadges(roles) {
  return badges.filter((b, id) => roles.hasAny(id, ...b.overrides)).toJSON();
}

module.exports = { getBadges, getBadgeData };
