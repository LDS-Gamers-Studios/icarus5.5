// @ts-check

const { sf } = require("../utils/utils");
const config = require("../config/config.json");
const Discord = require("discord.js");

const permFuncs = {
  botOwner: m => config.ownerId === m.id,
  botAdmin: m => config.adminId.includes(m.id) || permFuncs.botOwner(m),
  mgmt: m => m.roles.cache.has(sf.roles.management),
  mgr: m => m.roles.cache.has(sf.roles.manager),
  mod: m => m.roles.cache.has(sf.roles.mod),
  botTeam: m => m.roles.cache.has(sf.roles.botTeam),
  team: m => m.roles.cache.has(sf.roles.team),
  volunteer: m => m.roles.cache.has(sf.roles.volunteer),
  trustPlus: m => m.roles.cache.has(sf.roles.trustedplus),
  trusted: m => m.roles.cache.has(sf.roles.trusted),
  notMuted: m => !m.roles.cache.has(sf.roles.muted),
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
  isAdmin: (member) => config.adminId.includes(member.id) || perms.isOwner(member),
  isOwner: (member) => member.id === config.ownerId,
  isMod: function(msg) {
    const roles = msg.member?.roles.cache;
    return roles?.has(sf.roles.mod) || roles?.has(sf.roles.management);
  },
  isMgmt: (member) => member.roles.cache.has(sf.roles.management),
  isMgr: (msg) => msg.member?.roles.cache.has(sf.roles.manager),
  isTeam: function(msg) {
    const roles = msg.member?.roles.cache;
    return roles?.has(sf.roles.team) || roles?.has(sf.roles.management);
  },
  isTrusted: function(msg) {
    const roles = msg.member?.roles.cache;
    return roles?.has(sf.roles.trusted) && !roles?.has(sf.roles.untrusted);
  }
};

module.exports = perms;
