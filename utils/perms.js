const { sf } = require("../utils/utils");
const u = require("../config/config");

const perms = {
  isAdmin: (msg) => u.adminId.includes((msg.author ?? msg.user).id),
  isOwner: (msg) => (msg.author ?? msg.user).id === u.ownerId,
  isMod: function(msg) {
    const roles = msg.member?.roles.cache;
    return roles?.has(sf.roles.mod) || roles?.has(sf.roles.management);
  },
  isMgmt: (msg) => msg.member?.roles.cache.has(sf.roles.management),
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
