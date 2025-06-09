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
 * @prop { string | null } badgeLore
*/

/**
 * @typedef Role
 * @prop { "Equip" | "Comment" | "Team Assign" | "Rank" | "Year" } type
 * @prop {Discord.Role} base
 * @prop { Discord.Role | null } color
 * @prop { string[] } parents
 * @prop { string | null } level
 * @prop { string | null } badge
 * @prop { string | null } badgeLore
 */

/** @typedef {Omit<Role, "color"> & { color: Discord.Role }} ColorRole  */
/** @typedef {Omit<Role, "level"> & { level: string }} LevelStrRole  */
/** @typedef {Omit<Role, "level"> & { level: number }} LevelNumRole  */

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
 * @typedef Starboard
 * @prop {Discord.GuildTextBasedChannel} channel
 * @prop {Set<string>} priorityChannels
 * @prop {Set<string>} priorityEmoji
 * @prop {number} threshold
 * @prop {boolean} approval
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