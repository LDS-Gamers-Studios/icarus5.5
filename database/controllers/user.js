// @ts-check
const Discord = require("discord.js"),
  moment = require("moment"),
  config = require("../../config/config.json");

const User = require("../models/User.model");
const ChannelXP = require("../models/ChannelXP.model");

/**
 * @typedef UserRecord
 * @prop {string} discordId The ID of the user
 * @prop {string[]} roles IDs of roles the user had when they left the server
 * @prop {string[]} badges Currently unused
 * @prop {number} posts The count of active chat minutes
 * @prop {number} voice The count of minutes spent in voice channels
 * @prop {number} trackXP Setting for tracking XP. See TrackXPEnum for details
 * @prop {number} currentXP Season XP
 * @prop {number} totalXP Lifetime XP
 * @prop {number} priorTenure How many days they've spent in the server, updated when they leave
 * @prop {boolean} sendBdays Setting for receiving birthday spam
 * @prop {boolean} watching If this user is on the watchlist
 * @prop {boolean} twitchFollow If they've followed the LDSG Twitch channel
 */

/**
 * @typedef {UserRecord & {rank: {season: number, lifetime: number}}} RankedUser
 */

/**
 * @typedef leaderboardOptions Options for the leaderboard fetch
 * @prop {Discord.Collection<string, Discord.GuildMember> | string[]} memberIds Collection or Array of snowflakes to include in the leaderboard
 * @prop {number} [limit] The number of users to limit the search to
 * @prop {string} [member] A user to include in the results, no matter their ranking.
 * @prop {boolean} [season] Whether to fetch the current season (`true`, default) or lifetime (`false`) leaderboard.
 */

const outdated = "Expected a Discord ID but likely recieved an object instead. That's deprecated now!";

/**
 * @enum {number}
 */
const TrackXPEnum = {
  OFF: 0,
  SILENT: 1,
  FULL: 2
};


const models = {
  TrackXPEnum,
  /**
     * Add XP to a set of users
     * @param {Discord.Collection<string, import("../../modules/xp").ActiveUser[]>} activity Users to add XP, as well as their multipliers
     * @returns {Promise<{users: UserRecord[], oldUsers: UserRecord[], xp: number}>}
     */
  addXp: async function(activity) {
    const xpBase = Math.floor(Math.random() * 3) + config.xp.base;
    const included = await User.find({ discordId: { $in: [...activity.keys()] }, trackXP: { $ne: TrackXPEnum.OFF } }, undefined, { lean: true });
    const uniqueIncluded = new Set(included.map(u => u.discordId));
    await User.bulkWrite(
      activity.map((val, discordId) => {
        // add the multiple bonuses together
        const x = Math.ceil(xpBase * val.reduce((p, c) => c.multiplier + p, 0));
        const xp = uniqueIncluded.has(discordId) ? x : 0;
        if (!Number.isFinite(xp)) throw new Error(`${discordId} achieved INFINITE XP!`);
        if (xp > 500) throw new Error(`${discordId} was going to get ${xp} xp. That doesn't seem safe!\n${JSON.stringify(val)}`);
        const posts = val.filter(v => v.isMessage).length;
        const voice = val.filter(v => v.isVoice).length;
        return {
          updateOne: {
            filter: { discordId },
            update: { $inc: { currentXP: xp, totalXP: xp, posts, voice } },
            upsert: true,
            new: true
          }
        };
      })
    );
    const userDocs = await User.find(
      { discordId: { $in: [...activity.keys()] } }, null, { lean: true }
    ).exec();
    // update channel xp
    /** @type {Discord.Collection<string, number[]>} */
    const uniqueChannels = new Discord.Collection();
    const channels = activity.filter((_, id) => uniqueIncluded.has(id)).map(a => a).flat();
    for (const val of channels) {
      uniqueChannels.ensure(val.channelId, () => []).push(val.multiplier);
    }
    // no need to wait for it to finish before moving on
    ChannelXP.bulkWrite(
      uniqueChannels.map((v, channelId) => {
        const xp = Math.ceil(xpBase * v.reduce((p, c) => p + c, 0));
        return {
          updateOne: {
            filter: { channelId },
            update: { $inc: { xp } },
            upsert: true,
            new: true
          }
        };
      })
    );
    return { users: userDocs, oldUsers: included, xp: xpBase };
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
   * DANGER!!! THIS RESETS ALL CURRENTXP TO 0
   */
  resetSeason: async function() {
    await ChannelXP.deleteMany({}, { lean: true, new: true });
    return User.updateMany({ currentXP: { $gt: 0 } }, { currentXP: 0 }, { lean: true, new: true }).exec();
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
    const query = User.find({ trackXP: { $ne: TrackXPEnum.OFF }, discordId: { $in: members } }, undefined, { lean: true });
    if (season) query.sort({ currentXP: "desc" });
    else query.sort({ totalXP: "desc" });

    const records = await query.limit(limit).exec();
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
   * @param {Omit<leaderboardOptions, "season"> & { rank?: RankedUser | null }} options
   * @returns {Promise<{ season: (UserRecord & { rank: number })[], life: (UserRecord & { rank: number })[] }>}
   */
  getBothLeaderboards: async function(options) {
    const members = (options.memberIds instanceof Discord.Collection ? Array.from(options.memberIds.keys()) : options.memberIds);
    const member = options.member;
    const limit = options.limit ?? 10;

    /** @param {UserRecord[]} users */
    const mapper = (users) => users.map((u, i) => ({ ...u, rank: i + 1 }));

    const query = () => User.find({ trackXP: { $ne: TrackXPEnum.OFF }, discordId: { $in: members } }, undefined, { lean: true }).limit(limit);
    const season = await query().sort({ currentXP: "desc" }).exec().then(mapper);
    const life = await query().sort({ totalXP: "desc" }).exec().then(mapper);

    // Get requested user
    const seasonHas = season.some(r => r.discordId === member);
    const lifeHas = life.some(r => r.discordId === member);
    if (member && (!seasonHas || !lifeHas)) {
      const record = options.rank ?? await models.getRank(member, members);
      if (record && record.trackXP !== TrackXPEnum.OFF) {
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
  getRank: async function(discordId, members, filterOptedOut = true) {
    members = (members instanceof Discord.Collection ? Array.from(members.keys()) : members);

    // Get requested user
    const record = await User.findOne({ discordId }, undefined, { lean: true }).exec();
    if (!record || (filterOptedOut && record.trackXP === TrackXPEnum.OFF)) return null;

    const seasonCount = await User.count({ trackXP: { $ne: TrackXPEnum.OFF }, currentXP: { $gt: record.currentXP }, discordId: { $in: members } });
    const lifeCount = await User.count({ trackXP: { $ne: TrackXPEnum.OFF }, totalXP: { $gt: record.totalXP }, discordId: { $in: members } });

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
   * Gets all the channel xp info
   */
  getChannelXPs: function() {
    return ChannelXP.find({}, undefined, { lean: true }).exec();
  },
  /**
   * Updates a property
   * @param {string} discordId The guild member to change
   * @param {Partial<UserRecord>} update
   * @returns {Promise<UserRecord | null>}
   */
  update: function(discordId, update) {
    if (typeof discordId !== "string") throw new Error(outdated);
    return User.findOneAndUpdate({ discordId }, update, { lean: true, new: true, upsert: true });
  }
};

module.exports = models;
