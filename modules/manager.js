// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const Rank = require("../utils/rankInfo");

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashManagerUserTransfer(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  // get users
  const oldUser = int.options.getMember("old");
  const oldId = oldUser?.id ?? int.options.getString("old-id");
  if (!oldId) return int.editReply("I couldnt find the old user!");

  const newUser = int.options.getMember("new");
  if (!newUser) return int.editReply("I couldnt find the new user!");

  // get user db records
  const oldUserDoc = await u.db.user.fetchUser(oldId);
  if (!oldUserDoc) return int.editReply("Failed to find old user's db entry");

  const newUserDoc = await u.db.user.fetchUser(newUser.id, true);
  if (!newUserDoc) return int.editReply("Failed to find new user's db entry");
  const newUserDocBackup = { ...newUserDoc };

  // update doc properties
  newUserDoc.totalXP += oldUserDoc.totalXP;
  newUserDoc.currentXP += oldUserDoc.currentXP;

  if (oldUser) newUserDoc.priorTenure += Math.abs(u.moment(newUser.joinedTimestamp).diff(u.moment(oldUser.joinedTimestamp), "days"));
  newUserDoc.priorTenure += oldUserDoc.priorTenure;

  // update user roles (and kick if applicable)
  const roles = newUser.roles.cache;
  if (oldUser) {
    const oldRoles = oldUser.roles.cache.clone();
    oldRoles.delete(u.sf.roles.houses.housebb);
    oldRoles.delete(u.sf.roles.houses.housefb);
    oldRoles.delete(u.sf.roles.houses.housesc);

    for (const [id, role] of oldRoles) {
      if (
        role.comparePositionTo(u.sf.roles.icarus) >= 0 ||
        role.managed ||
        roles.has(id) ||
        u.db.sheets.roles.equip.has(id)
      ) continue;

      roles.set(id, role);
    }

    await oldUser.kick("Account Transfer");

  } else if (oldUserDoc.roles.length > 0) {
    for (const roleId of oldUserDoc.roles) {
      const role = int.guild.roles.cache.get(roleId);
      if (
        !role ||
        role.comparePositionTo(u.sf.roles.icarus) >= 0 ||
        role.managed ||
        roles.has(roleId) ||
        u.db.sheets.roles.equip.has(roleId)
      ) continue;

      roles.set(roleId, role);
    }
  }

  // calculate new rank and give appropriate rank role
  u.db.sheets.roles.rank.forEach(r => roles.delete(r.base.id));

  const level = Rank.level(newUserDoc.totalXP);
  const levelRole = u.db.sheets.roles.rank.find(r => level >= r.level);
  if (levelRole) roles.set(levelRole.base.id, levelRole.base);

  // same thing but with tenure
  const joined = u.moment(newUser.joinedTimestamp).subtract(newUserDoc.priorTenure);
  const year = Math.floor(u.moment().diff(joined, "years"));
  const yearRole = u.db.sheets.roles.year.get(year);

  if (yearRole && !newUser.roles.cache.has(yearRole.base.id)) {
    u.db.sheets.roles.year.forEach(r => roles.delete(r.base.id));
    roles.set(yearRole.base.id, yearRole.base);
  }

  if (roles.size > 0) await newUser.roles.set(roles);

  // update db entries
  const updatedUser = await u.db.user.update(newUser.id, {
    priorTenure: newUserDoc.priorTenure,
    totalXP: newUserDoc.totalXP,
    currentXP: newUserDoc.currentXP,
    twitchFollow: newUserDoc.twitchFollow || oldUserDoc.twitchFollow,
    posts: newUserDoc.posts + oldUserDoc.posts,
    voice: newUserDoc.voice + oldUserDoc.voice,
    badges: u.unique(newUserDoc.badges.concat(oldUserDoc.badges))
  });

  const updatedIgns = await u.db.ign.transfer(oldId, newUser.id);
  const updatedInfractions = await u.db.infraction.transfer(oldId, newUser.id);
  const updatedTransactions = await u.db.bank.transfer(oldId, newUser.id);
  const updatedReminders = await u.db.reminder.transfer(oldId, newUser.id);

  // generate results embed
  const diff = (/** @type {"priorTenure"|"posts"|"voice"|"totalXP"|"currentXP"} */ prop) => `+${(updatedUser?.[prop] ?? 0) - newUserDocBackup[prop]} ${prop}`;
  const embed = u.embed().setTitle("User Transfer")
    .setDescription("Transfered the following information:\n" +
      `User: ${diff("priorTenure")}, ${diff("totalXP")}, ${diff("currentXP")}, ${diff("posts")}, ${diff("voice")}\n` +
      `IGNs: ${updatedIgns.modifiedCount}\n` +
      `Infractions: ${updatedInfractions.modifiedCount}\n` +
      `Transactions: ${updatedTransactions.modifiedCount}\n` +
      `Reminders: ${updatedReminders.modifiedCount}`
    );

  return int.editReply({ embeds: [embed] });
}

const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashManager,
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