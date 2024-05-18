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
  destinyAdmin: m => m.roles.cache.has(sf.roles.destinyclansadmin),
  /** @type {perm} */
  destinyManager: m => m.roles.cache.has(sf.roles.destinyclansmanager),
  /** @type {perm} */
  destinyValiantAdmin: m => m.roles.cache.has(sf.roles.destinyvaliantadmin),
  /** @type {perm} */
  mgmt: m => m.roles.cache.has(sf.roles.management) || (config.ownerOverride && permFuncs.botOwner(m)),
  /** @type {perm} */
  mgr: m => m.roles.cache.has(sf.roles.manager),
  /** @type {perm} */
  mod: m => m.roles.cache.has(sf.roles.mod),
  /** @type {perm} */
  mcMod: m => m.roles.cache.has(sf.roles.minecraftmod),
  /** @type {perm} */
  botTeam: m => m.roles.cache.has(sf.roles.botTeam),
  /** @type {perm} */
  team: m => m.roles.cache.has(sf.roles.team),
  /** @type {perm} */
  volunteer: m => m.roles.cache.has(sf.roles.volunteer),
  /** @type {perm} */
  trustPlus: m => m.roles.cache.has(sf.roles.trustedplus),
  /** @type {perm} */
  trusted: m => m.roles.cache.has(sf.roles.trusted),
  /** @type {perm} */
  notMuted: m => !m.roles.cache.hasAny(sf.roles.muted, sf.roles.ducttape),
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
    let result = false;
    if (!member) return false;
    for (const perm of [...new Set(permArr.concat(["mgmt"]))]) {
      const p = permFuncs[perm];
      if (p) result = p(member);
      if (result) break;
    }
    return result;
  },
  /** @typedef {(m: Discord.GuildMember | null | undefined) => boolean | null | undefined} mem*/
  /** @type {mem} */
  isAdmin: (m) => m && permFuncs.botAdmin(m),
  /** @type {mem} */
  isDestinyAdmin: (m) => m && permFuncs.destinyAdmin(m),
  /** @type {mem} */
  isDestinyManager: (m) => m && permFuncs.destinyManager(m),
  /** @type {mem} */
  isDestinyValiantAdmin: (m) => m && permFuncs.destinyValiantAdmin(m),
  /** @type {mem} */
  isOwner: (m) => m && permFuncs.botOwner(m),
  /** @type {mem} */
  isMod: (m) => m && permFuncs.mod(m),
  /** @type {mem} */
  isMgmt: (m) => m && permFuncs.mgmt(m),
  /** @type {mem} */
  isMgr: (m) => m && permFuncs.mgr(m),
  /** @type {mem} */
  isTeam: (m) => m && permFuncs.team(m),
  /** @type {mem} */
  isTrusted: (m) => m && permFuncs.trusted(m),
  /** @type {mem} */
  isntMuted: (m) => m && permFuncs.notMuted(m)
};

module.exports = perms;
