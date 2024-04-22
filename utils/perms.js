// @ts-check

const { sf } = require("../utils/utils");
const config = require("../config/config.json");
const Discord = require("discord.js");

/** @typedef {(m: Discord.GuildMember) => boolean} perm */
const permFuncs = {
  /** @type {perm} */
  botOwner: m => config.ownerId === m.id,
  /** @type {perm} */
  botAdmin: m => config.adminId.includes(m.id) || permFuncs.botOwner(m),
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
  /** @param {Discord.GuildMember} member @param {(keyof permFuncs)[]} permArr*/
  calc: (member, permArr) => {
    let result = false;
    const arr = [...new Set(permArr.concat(["botAdmin", "mgmt"]))];
    for (const perm of arr) {
      const p = permFuncs[perm];
      if (p) result = p(member);
      if (result) break;
    }
    return result;
  },
  isAdmin: permFuncs.botAdmin,
  isOwner: permFuncs.botOwner,
  isMod: permFuncs.mod,
  isMgmt: permFuncs.mgmt,
  isMgr: permFuncs.mgr,
  isTeam: permFuncs.team,
  isTrusted: permFuncs.trusted
};

module.exports = perms;
