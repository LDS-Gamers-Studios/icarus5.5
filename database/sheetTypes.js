const Discord = require("discord.js");

/**
 * @typedef Game
 * @prop { string } title
 * @prop { string } system
 * @prop { string } rating
 * @prop { number } cost
 * @prop { string | null } recipient
 * @prop { string } code
 * @prop { string } key
 * @prop { string } steamId
 * @prop { Date | null } date
 */

/**
 * @typedef IGN
 * @prop { string } name
 * @prop { string } system
 * @prop { string } category
 * @prop { string[] } aliases
 * @prop { string | null } link
 */

/**
 * @typedef OptRole
 * @prop { string } name
 * @prop {Discord.Role} role
 * @prop { string | null } badge
*/

/**
 * @typedef Role
 * @prop { "Equip" | "Comment" | "Team Assign" | "Rank" | "Year" } type
 * @prop {Discord.Role} base
 * @prop { Discord.Role | null } color
 * @prop { string[] } parents
 * @prop { string | null } level
 * @prop { string | null } badge
 */

/**
 * @typedef {Omit<Role, "level" | "color"> & { level: string, color: Discord.Role }} FullRole
 */

/**
 * @typedef Sponsor
 * @prop { string } userId
 * @prop { Discord.TextChannel | null } channel
 * @prop { string | null } emojiId
 * @prop { boolean } enabled
 * @prop { Date | null } archiveAt
 */

/**
 * @typedef TourneyChampion
 * @prop { string } tourneyName
 * @prop { string } userId
 * @prop { Date | null } takeAt
 * @prop { string } key
 */

/**
 * @typedef ChannelXPSetting
 * @prop { string } channelId
 * @prop { Set<string> } emoji
 * @prop { number } posts
 * @prop { boolean } preferMedia
 */

/**
 * @typedef PlayingDefault
 * @prop {string} channelId
 * @prop {string} name
 */

module.exports = {};