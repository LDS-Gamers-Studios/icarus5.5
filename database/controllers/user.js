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
        { new: true, upsert: true }
      ).exec();
      // Update post count for all users
      await User.updateMany(
        { discordId: { $in: users } },
        { $inc: { posts: 1 } },
        { new: true, upsert: true }
      ).exec();
      const userDocs = await User.find(
        { discordId: { $in: users } }, null, { upsert: true }
      ).exec();
      return { users: userDocs.map(d => d.toObject()), xp };
    }
  },
  /**
   * Fetch a user record from the database.
   * @param {string} discordId The user record to fetch.
   * @returns {Promise<UserRecord | undefined>}
   */
  fetchUser: async function(discordId, createIfNotFound = true) {
    if (typeof discordId != "string") throw new TypeError(outdated);
    /** @type  {UserRecord | undefined}*/
    let user = (await User.findOne({ discordId }).exec())?.toObject();
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
    const records = await query.exec();
    /** @type {(UserRecord & {rank: number})[]} */
    const ranked = records.map((r, i) => {
      return { ...r.toObject(), rank: i + 1 };
    });

    // Get requested user
    const hasMember = ranked.some(r => r.discordId == member);
    if (member && !hasMember) {
      const record = await models.getRank(member, members);
      if (record) {
        ranked.push({ ...record, rank: season ? record.rank.season : record.rank.lifetime });
      }
    }

    return ranked;
  },
  /**
     * Get a user's rank
     * @function getRank
     * @param {string} [member] The member whose ranking you want to view.
     * @param {Discord.Collection|Array} [members] Collection or Array of snowflakes to include in the leaderboard
     * @returns {Promise<(UserRecord & {rank: {season: number, lifetime: number}}) | null>}
     */
  getRank: async function(member, members) {
    if (!member) return null;
    members = (members instanceof Discord.Collection ? Array.from(members.keys()) : members);

    // Get requested user

    const record = await User.findOne({ discordId: member, excludeXP: false }).exec();
    if (!record) return null;

    const seasonParams = { excludeXP: false, currentXP: { $gt: record.currentXP } };
    if (members) seasonParams.discordId = { $in: members };
    const seasonCount = await User.count(seasonParams);

    const lifetimeParams = { excludeXP: false, totalXP: { $gt: record.totalXP } };
    if (members) lifetimeParams.discordId = { $in: members };
    const lifeCount = await User.count(lifetimeParams);

    return { ...record.toObject(), rank: { season: seasonCount + 1, lifetime: lifeCount + 1 } };
  },
  /**
   * Run a user database query
   * @param {object} query
   * @returns {Promise<UserRecord[]>}
   */
  getUsers: function(query) {
    return User.find(query).exec().then(users => users.map(u => u.toObject()));
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
      return exists.toObject();
    } else {
      const newMember = new User({
        discordId
      });
      return newMember.save().then(m => m.toObject());
    }
  },
  /**
   * Update a member's track XP preference
   * @param {string} member The guild member to update.
   * @param {boolean} track Whether to track the member's XP.
   * @returns {Promise<UserRecord>}
   */
  trackXP: function(member, track = true) {
    return User.findOneAndUpdate(
      { discordId: member },
      { $set: { excludeXP: !track } },
      { new: true, upsert: true }
    ).exec().then(d => d.toObject());
  },
  /**
   * Update a member's roles in the database
   * @function updateRoles
   * @param {Discord.GuildMember} member The member to update
   * @return {Promise<UserRecord>}
   */
  updateRoles: function(member) {
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $set: { roles: Array.from(member.roles.cache.keys()) } },
      { new: true, upsert: true }
    ).exec().then(u => u.toObject());
  },
  /**
   * Updates a guild member's tenure in the server database.
   * @param {Discord.GuildMember} member The guild member to update.
   * @returns {Promise<UserRecord>}
   */
  updateTenure: function(member) {
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $inc: { priorTenure: (moment().diff(moment(member.joinedAt), "days") || 0) } },
      { new: true, upsert: true }
    ).exec().then(m => m.toObject());
  }
};

module.exports = models;
