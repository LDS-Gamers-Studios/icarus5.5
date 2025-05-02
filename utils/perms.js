// @ts-check
const config = require("../config/config.json"),
  Discord = require("discord.js"),
  snowflakes = require("../config/snowflakes.json"),
  tsf = require("../config/snowflakes-testing.json");

// circular dependancy, had to duplicate code :(
const sf = config.devMode ? tsf : snowflakes;

/** @typedef {(m: Discord.GuildMember) => boolean} perm */
const permFuncs = {
  /** @type {perm} */
  botOwner: m => config.ownerId === m.id,
  /** @type {perm} */
  botAdmin: m => config.adminId.includes(m.id) || permFuncs.botOwner(m),
  /** @type {perm} */
  destinyAdmin: m => m.roles.cache.has(sf.roles.destiny.clansAdmin),
  /** @type {perm} */
  destinyManager: m => m.roles.cache.has(sf.roles.destiny.clansManager),
  /** @type {perm} */
  destinyValiantAdmin: m => m.roles.cache.has(sf.roles.destiny.valiantAdmin),
  /** @type {perm} */
  mgmt: m => m.roles.cache.has(sf.roles.team.management) || (config.ownerOverride && permFuncs.botOwner(m)),
  /** @type {perm} */
  mgr: m => m.roles.cache.has(sf.roles.team.manager),
  /** @type {perm} */
  mod: m => m.roles.cache.has(sf.roles.team.mod),
  /** @type {perm} */
  mcMod: m => m.roles.cache.has(sf.roles.team.minecraftMod),
  /** @type {perm} */
  botTeam: m => m.roles.cache.has(sf.roles.team.botTeam),
  /** @type {perm} */
  team: m => m.roles.cache.has(sf.roles.team.team),
  /** @type {perm} */
  volunteer: m => m.roles.cache.has(sf.roles.team.volunteer),
  /** @type {perm} */
  inHouse: m => m.roles.cache.hasAny(sf.roles.houses.housebb, sf.roles.houses.housefb, sf.roles.houses.housesc),
  /** @type {perm} */
  trustPlus: m => m.roles.cache.has(sf.roles.moderation.trustedPlus),
  /** @type {perm} */
  trusted: m => m.roles.cache.has(sf.roles.moderation.trusted),
  /** @type {perm} */
  notMuted: m => !m.roles.cache.hasAny(sf.roles.moderation.muted, sf.roles.moderation.ductTape),
  /** @type {perm} */
  everyone: () => true
};

const perms = {
  /**
   * Generate a boolean based on a list of provided roles. Bot Owner and MGMT always bypass.
   * @param {Discord.GuildMember | null | undefined} member
   * @param {(keyof permFuncs)[]} permArr
   */
  calc: (member, permArr) => {
    if (!member) return false;
    permArr.push("mgmt");
    for (const perm of new Set(permArr)) {
      const p = permFuncs[perm];
      if (p && p(member)) return true;
    }
    return false;
  },
  /**
   * @param {Discord.GuildMember | null |undefined } m
   */
  isOwner: (m) => m && permFuncs.botOwner(m)
};

/**
 * @typedef {keyof permFuncs} Perms
 */

module.exports = perms;
