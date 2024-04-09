// @ts-check
const Discord = require("discord.js"),
  moment = require("moment");

const User = require("../models/User.model");

/**
 * @typedef UserRecord
 * @prop {string} discordId
 * @prop {string[]} roles
 * @prop {string[]} badges
 * @prop {number} posts
 * @prop {boolean} excludeXP
 * @prop {number} currentXP
 * @prop {number} totalXP
 * @prop {number} priorTenure
 * @prop {boolean} twitchFollow
 */

/**
 * @typedef leaderboardOptions Options for the leaderboard fetch
 * @prop {Discord.Collection | Array} [members] Collection or Array of snowflakes to include in the leaderboard
 * @prop {number} [limit] The number of users to limit the search to
 * @prop {string} [member] A user to include in the results, no matter their ranking.
 * @prop {boolean} [season] Whether to fetch the current season (`true`, default) or lifetime (`false`) leaderboard.
 */

const outdated = "Expected a Discord ID but likely recieved an object instead. That's deprecated now!";

const models = {
  /**
     * Add XP to a set of users
     * @param {string[]} users Users to add XP
     * @returns {Promise<{users: UserRecord[], xp: number}>}
     */
  addXp: async function(users) {
    const xp = Math.floor(Math.random() * 11) + 15;
    if (users.length == 0) {
      return { users: [], xp: 0 };
    } else {
      // Update XP for ranked users
      await User.updateMany(
        { discordId: { $in: users }, excludeXP: false },
        { $inc: { currentXP: xp, totalXP: xp } },
        { new: true, upsert: false }
      ).exec();
      // Update post count for all users
      await User.updateMany(
        { discordId: { $in: users } },
        { $inc: { posts: 1 } },
        { new: true, upsert: false }
      ).exec();
      const userDocs = await User.find(
        { discordId: { $in: users } }
      ).exec();
      return { users: userDocs, xp };
    }
  },
  /**
   * Fetch a user record from the database.
   * @param {string} discordId The user record to fetch.
   * @returns {Promise<UserRecord | null>}
   */
  fetchUser: async function(discordId, createIfNotFound = true) {
    if (typeof discordId != "string") throw new TypeError(outdated);
    /** @type {UserRecord | null} */
    let user = await User.findOne({ discordId }).exec();
    if (!user && createIfNotFound) {
      user = await models.newUser(discordId);
    }
    return user;
  },
  /**
   * Get the top X of the leaderboard
   * @param {leaderboardOptions} options
   * @returns {Promise<(UserRecord & {rank: number})[]>}
   */
  getLeaderboard: async function(options = {}) {
    const members = (options.members instanceof Discord.Collection ? Array.from(options.members.keys()) : options.members);
    const member = options.member;
    const season = options.season ?? true;
    const limit = options.limit ?? 10;

    // Get top X users first
    const params = { excludeXP: false };
    if (members) params.discordId = { $in: members };

    const query = User.find(params);
    if (season) query.sort({ currentXP: "desc" });
    else query.sort({ totalXP: "desc" });

    if (limit) query.limit(limit);
    /** @type {UserRecord[]} */
    const records = await query.exec();
    const ranked = records.map((r, i) => {
      return { ...r, rank: i + 1 };
    });

    // Get requested user
    const hasMember = ranked.some(r => r.discordId == member);
    if (member && !hasMember) {
      const record = await models.getRank(member, members, !season);
      if (record) {
        ranked.push(record);
      }
    }

    return ranked;
  },
  /**
     * Get a user's rank
     * @function getRank
     * @param {string} [member] The member whose ranking you want to view.
     * @param {Discord.Collection|Array} [members] Collection or Array of snowflakes to include in the leaderboard
     * @param {boolean} [lifetime] Returns the lifetime rank instead of the season rank
     * @returns {Promise<(UserRecord & { rank: number }) | null>}
     */
  getRank: async function(member, members, lifetime = false) {
    if (!member) return null;
    members = (members instanceof Discord.Collection ? Array.from(members.keys()) : members);

    // Get requested user
    /** @type {UserRecord | null} */
    const record = await User.findOne({ discordId: member, excludeXP: false }).exec();
    if (!record) return null;
    const countParams = { excludeXP: false, currentXP: { $gt: record.currentXP } };
    if (members) countParams.discordId = { $in: members };
    const currentCount = await User.count(countParams);
    const rankedRecord = { ...record, rank: currentCount + 1 };

    const countParams2 = { excludeXP: false, totalXP: { $gt: rankedRecord.totalXP } };
    if (members) countParams2.discordId = { $in: members };
    if (lifetime) {
      const life = await User.count(countParams2);
      rankedRecord.rank = life + 1;
    }

    return rankedRecord;
  },
  /**
   * Run a user database query
   * @param {object} query
   * @returns {Promise<UserRecord[]>}
   */
  getUsers: function(query) {
    return User.find(query).exec();
  },
  /**
   * Create a new user record
   * @function newUser
   * @param {string} discordId The guild member record to create
   * @returns {Promise<UserRecord>}
   */
  newUser: async function(discordId) {
    if (typeof discordId != "string") throw new TypeError(outdated);
    const exists = await User.findOne({ discordId }).exec();
    if (exists) {
      return exists;
    } else {
      const newMember = new User({
        discordId
      });
      return newMember.save();
    }
  },
  /**
   * Update a member's track XP preference
   * @param {string} member The guild member to update.
   * @param {boolean} track Whether to track the member's XP.
   * @returns {Promise<UserRecord | null>}
   */
  trackXP: function(member, track = true) {
    return User.findOneAndUpdate(
      { discordId: member },
      { $set: { excludeXP: !track } },
      { new: true, upsert: false }
    ).exec();
  },
  /**
   * Update a member's roles in the database
   * @function updateRoles
   * @param {Discord.GuildMember} member The member to update
   * @return {Promise<UserRecord | null>}
   */
  updateRoles: function(member) {
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $set: { roles: Array.from(member.roles.cache.keys()) } },
      { new: true, upsert: false }
    ).exec();
  },
  /**
   * Updates a guild member's tenure in the server database.
   * @param {Discord.GuildMember} member The guild member to update.
   * @returns {Promise<UserRecord | null>}
   */
  updateTenure: function(member) {
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $inc: { priorTenure: (moment().diff(moment(member.joinedAt), "days") || 0) } },
      { new: true, upsert: false }
    ).exec();
  }
};

module.exports = models;
