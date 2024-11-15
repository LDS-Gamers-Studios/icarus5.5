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
 * @prop {boolean} watching
 */

/**
 * @typedef leaderboardOptions Options for the leaderboard fetch
 * @prop {Discord.Collection<string, Discord.GuildMember> | string[]} memberIds Collection or Array of snowflakes to include in the leaderboard
 * @prop {number} [limit] The number of users to limit the search to
 * @prop {string} [member] A user to include in the results, no matter their ranking.
 * @prop {boolean} [season] Whether to fetch the current season (`true`, default) or lifetime (`false`) leaderboard.
 */

const outdated = "Expected a Discord ID but likely recieved an object instead. That's deprecated now!";

const models = {
  /**
     * Add XP to a set of users
     * @param {string[]} userIds Users to add XP
     * @returns {Promise<{users: UserRecord[], xp: number}>}
     */
  addXp: async function(userIds) {
    const xp = Math.floor(Math.random() * 11) + 15;
    const included = (await User.find({ discordId: { $in: userIds }, excludeXP: false }, undefined, { lean: true })).map(u => u.discordId);
    await User.bulkWrite(
      userIds.map(u => {
        const x = included.includes(u) ? xp : 0;
        return {
          updateOne: {
            filter: { discordId: u },
            update: { $inc: { currentXP: x, totalXP: x, posts: 1 } },
            upsert: true,
            new: true
          }
        };
      })
    );
    const userDocs = await User.find(
      { discordId: { $in: userIds } }, null, { lean: true }
    ).exec();
    return { users: userDocs, xp };
  },
  /**
   * Fetch a user record from the database.
   * @param {string} discordId The user record to fetch.
   * @param {boolean} [createIfNotFound] Defaults to true
   * @returns {Promise<UserRecord | null>}
   */
  fetchUser: async function(discordId, createIfNotFound = true) {
    if (typeof discordId !== "string") throw new TypeError(outdated);
    return User.findOne({ discordId }, undefined, { lean: true, upsert: createIfNotFound }).exec();
  },
  /**
   * Get the top X of the leaderboard
   * @param {leaderboardOptions} options
   * @returns {Promise<(UserRecord & {rank: number})[]>}
   */
  getLeaderboard: async function(options) {
    const members = (options.memberIds instanceof Discord.Collection ? Array.from(options.memberIds.keys()) : options.memberIds);
    const member = options.member;
    const season = options.season;
    const limit = options.limit ?? 10;

    // Get top X users first
    const params = { excludeXP: false, discordId: { $in: members } };

    const query = User.find(params, undefined, { lean: true });
    if (season) query.sort({ currentXP: "desc" });
    else query.sort({ totalXP: "desc" });

    if (limit) query.limit(limit);
    const records = await query.exec();
    /** @type {(UserRecord & {rank: number})[]} */
    const ranked = records.map((r, i) => {
      return { ...r, rank: i + 1 };
    });

    // Get requested user
    const hasMember = ranked.some(r => r.discordId === member);
    if (member && !hasMember) {
      const record = await models.getRank(member, members);
      if (record) {
        ranked.push({ ...record, rank: season ? record.rank.season : record.rank.lifetime });
      }
    }

    return ranked;
  },
  /**
   * Get the top X of both leaderboards
   * @param {Omit<leaderboardOptions, "season">} options
   * @returns {Promise<{ season: (UserRecord & { rank: number })[], life: (UserRecord & { rank: number })[] }>}
   */
  getBothLeaderboards: async function(options) {
    const members = (options.memberIds instanceof Discord.Collection ? Array.from(options.memberIds.keys()) : options.memberIds);
    const member = options.member;
    const limit = options.limit ?? 10;

    /** @param {UserRecord[]} users */
    const mapper = (users) => users.map((u, i) => ({ ...u, rank: i + 1 }));

    const query = () => User.find({ excludeXP: false, discordId: { $in: members } }, undefined, { lean: true }).limit(limit);
    const season = await query().sort({ currentXP: "desc" }).exec().then(mapper);
    const life = await query().sort({ totalXP: "desc" }).exec().then(mapper);

    // Get requested user
    const seasonHas = season.some(r => r.discordId === member);
    const lifeHas = life.some(r => r.discordId === member);
    if (member && (!seasonHas || !lifeHas)) {
      const record = await models.getRank(member, members);
      if (record) {
        if (!seasonHas) season.push({ ...record, rank: record.rank.season });
        if (!lifeHas) life.push({ ...record, rank: record.rank.lifetime });
      }
    }

    return { season, life };
  },
  /**
     * Get a user's rank
     * @param {string} discordId The member whose ranking you want to view.
     * @param {Discord.Collection<string, Discord.GuildMember>|string[]} members Collection or Array of snowflakes to include in the leaderboard
     * @returns {Promise<(UserRecord & {rank: {season: number, lifetime: number}}) | null>}
     */
  getRank: async function(discordId, members) {
    members = (members instanceof Discord.Collection ? Array.from(members.keys()) : members);

    // Get requested user
    const record = await User.findOne({ discordId }, undefined, { lean: true }).exec();
    if (!record || record.excludeXP) return null;

    const seasonParams = { excludeXP: false, currentXP: { $gt: record.currentXP }, discordId: { $in: members } };
    const seasonCount = await User.count(seasonParams);

    const lifetimeParams = { excludeXP: false, totalXP: { $gt: record.totalXP }, discordId: { $in: members } };
    const lifeCount = await User.count(lifetimeParams);

    return { ...record, rank: { season: seasonCount + 1, lifetime: lifeCount + 1 } };
  },
  /**
   * Run a user database query
   * @param {object} query
   * @returns {Promise<UserRecord[]>}
   */
  getUsers: function(query) {
    return User.find(query, undefined, { lean: true }).exec();
  },
  /**
   * Create a new user record
   * @param {string} discordId The guild member record to create
   * @returns {Promise<UserRecord|null>}
   */
  newUser: async function(discordId) {
    if (typeof discordId !== "string") throw new TypeError(outdated);
    return User.findOne({ discordId }, undefined, { upsert: true, lean: true }).exec();
  },
  /**
   * Update a member's track XP preference
   * @param {string} discordId The guild member to update.
   * @param {boolean} track Whether to track the member's XP.
   * @returns {Promise<UserRecord | null>}
   */
  trackXP: function(discordId, track = true) {
    if (typeof discordId !== 'string') throw new Error(outdated);
    return User.findOneAndUpdate(
      { discordId },
      { $set: { excludeXP: !track } },
      { new: true, upsert: true, lean: true }
    ).exec();
  },
  /**
   * Update a member's roles in the database
   * @param {Discord.GuildMember} [member] The member to update
   * @param {string[]} [roles]
   * @param {string} [backupId]
   * @return {Promise<UserRecord | null>}
   */
  updateRoles: function(member, roles, backupId) {
    if (member && !(member instanceof Discord.GuildMember)) throw new Error("Expected a GuildMember");
    if (backupId && typeof backupId !== 'string') throw new Error(outdated);
    return User.findOneAndUpdate(
      { discordId: backupId ?? member?.id },
      { $set: { roles: Array.from(roles ?? member?.roles.cache.keys() ?? []) } },
      { new: true, upsert: true, lean: true }
    ).exec();
  },
  /**
   * Updates a guild member's tenure in the server database.
   * @param {Discord.GuildMember} member The guild member to update.
   * @returns {Promise<UserRecord | null>}
   */
  updateTenure: function(member) {
    if (!(member instanceof Discord.GuildMember)) throw new Error("Expected a GuildMember");
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $inc: { priorTenure: (moment().diff(moment(member.joinedAt), "days") || 0) } },
      { new: true, upsert: true, lean: true }
    ).exec();
  },
  /**
   * Watches or unwatches a user
   * @param {string} discordId The guild member to watch/unwatch
   * @param {boolean} status Set to watched or not (Default: true)
   * @returns {Promise<UserRecord | null>}
   */
  updateWatch: function(discordId, status = true) {
    if (typeof discordId !== "string") throw new Error(outdated);
    return User.findOneAndUpdate(
      { discordId },
      { $set: { watching: status } },
      { new: true, upsert: true, lean: true }
    ).exec();
  }
};

module.exports = models;
