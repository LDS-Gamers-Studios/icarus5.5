// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashManagerUserTransfer(int) {
  await int.deferReply({ ephemeral: true });

  const oldUser = int.options.getMember("old");
  const oldId = oldUser?.id ?? int.options.getString("old-backup");
  if (!oldId) return int.editReply("I couldnt find the old user!");

  const newUser = int.options.getMember("new-user");
  if (!newUser) return int.editReply("I couldnt find the new user!");

  const oldUserDoc = await u.db.user.fetchUser(oldId);

  if (oldUser) {
    const roles = newUser.roles.cache;
    for (const [id, role] of oldUser.roles.cache) {
      if (
        role.comparePositionTo(u.sf.roles.icarus) >= 0 ||
        role.managed ||
        roles.has(id) ||
        u.db.sheets.roles.equip.has(id)
      ) continue;

      const oldUserRank = u.db.sheets.roles.rank.find(r => r.base.id === id);
      const oldUserYear = u.db.sheets.roles.year.find(r => r.base.id === id);

      if (oldUserRank) {
        const newUserRank = u.db.sheets.roles.rank.find(r => r.base.id === id);
        if (!newUserRank || newUserRank.level < oldUserRank.level) roles.delete(newUserRank?.base.id ?? "");
        else continue;
      } else if (oldUserYear) {
        const newUserYear = u.db.sheets.roles.rank.find(r => r.base.id === id);
        if (!newUserYear || newUserYear.level < oldUserYear.level) roles.delete(oldUserYear?.base.id ?? "");
        else continue;
      }

      roles.set(id, role);
    }

    if (roles.size > 0) await newUser.roles.set(roles);

    await oldUser.kick("Account Transfer");
  }

  const newUserDoc = await u.db.user.fetchUser(newUser.id, true);
  if (!newUserDoc) return int.editReply("Failed to find new user's db entry");
  if (oldUserDoc) {
    if (oldUser) newUserDoc.priorTenure += u.moment(newUser.joinedTimestamp).diff(u.moment(oldUser.joinedTimestamp), "days");

    await u.db.user.update(newUser.id, {
      priorTenure: newUserDoc.priorTenure,
      totalXP: oldUserDoc.totalXP,
      currentXP: oldUserDoc.currentXP,
      twitchFollow: newUserDoc.twitchFollow || oldUserDoc.twitchFollow,
      posts: newUserDoc.posts + oldUserDoc.posts,
      voice: newUserDoc.voice + oldUserDoc.voice,
      badges: u.unique(newUserDoc.badges.concat(oldUserDoc.badges))
    });

  }
  await u.db.ign.transfer(oldId, newUser.id);
  await u.db.infraction.transfer(oldId, newUser.id);
  await u.db.bank.transfer(oldId, newUser.id);
  return int.editReply("Transfered!");
}

const Module = new Augur.Module()
.addInteraction({
  id: "",
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
      case "transfer": return slashManagerUserTransfer(int);
      default: throw new Error("Unhandled Subcommand - /mgr");
    }
  }
});

module.exports = Module;