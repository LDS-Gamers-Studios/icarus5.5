// @ts-check
const config = require("../config/config.json"),
  Discord = require("discord.js"),
  snowflakes = require("../config/snowflakes.json"),
  tsf = require("../config/snowflakes-testing.json"),
  csf = require("../config/snowflakes-testing-commands.json");

// circular dependancy, had to duplicate code :(
const sf = config.devMode ? Object.assign(tsf, csf) : snowflakes;

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
  mgmt: m => m.roles.cache.has(sf.roles.management),
  /** @type {perm} */
  mgr: m => m.roles.cache.has(sf.roles.manager),
  /** @type {perm} */
  mod: m => m.roles.cache.has(sf.roles.mod),
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
  notMuted: m => !m.roles.cache.has(sf.roles.muted),
  /** @type {perm} */
  everyone: () => true
};

const perms = {
  /** @param {Discord.GuildMember | null | undefined} member @param {(keyof permFuncs)[]} permArr*/
  calc: (member, permArr) => {
    let result = false;
    if (!member) return false;
    const arr = [...new Set(permArr.concat(["botAdmin", "mgmt"]))];
    for (const perm of arr) {
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
  isTrusted: (m) => m && permFuncs.trusted(m)
};

module.exports = perms;
