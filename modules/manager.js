// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const Rank = require("../utils/rankInfo");
const u = require("../utils/utils");
const c = require("../utils/modCommon");

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashManagerUserTransfer(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  // get users
  const newUser = int.options.getMember("new-user");
  if (!newUser) return int.editReply("I couldnt find the new user!");

  const oldUser = int.options.getMember("old-user");
  const oldId = oldUser?.id ?? int.options.getString("old-user-id");
  if (!oldId) return int.editReply("I couldnt find the old user!");

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
  const newRoles = newUser.roles.cache.clone();
  if (oldUser) {
    const oldRoles = oldUser.roles.cache.clone();
    oldRoles.delete(u.sf.roles.houses.housebb);
    oldRoles.delete(u.sf.roles.houses.housefb);
    oldRoles.delete(u.sf.roles.houses.housesc);

    for (const [id, role] of oldRoles) {
      if (
        role.comparePositionTo(u.sf.roles.icarus) >= 0 ||
        role.managed ||
        newRoles.has(id) ||
        u.db.sheets.roles.equip.has(id)
      ) continue;

      newRoles.set(id, role);
    }

    await oldUser.kick("Account Transfer");

  } else if (oldUserDoc.roles.length > 0) {
    for (const roleId of oldUserDoc.roles) {
      const role = int.guild.roles.cache.get(roleId);
      if (
        !role ||
        role.comparePositionTo(u.sf.roles.icarus) >= 0 ||
        role.managed ||
        newRoles.has(roleId) ||
        u.db.sheets.roles.equip.has(roleId)
      ) continue;

      newRoles.set(roleId, role);
    }
  }

  // calculate new rank and give appropriate rank role
  u.db.sheets.roles.rank.forEach(r => newRoles.delete(r.base.id));

  const level = Rank.level(newUserDoc.totalXP);
  const levelRole = u.db.sheets.roles.rank.find(r => level >= r.level);
  if (levelRole) newRoles.set(levelRole.base.id, levelRole.base);

  // same thing but with tenure
  const joined = u.moment(newUser.joinedTimestamp).subtract(newUserDoc.priorTenure);
  const year = Math.floor(u.moment().diff(joined, "years"));
  const yearRole = u.db.sheets.roles.year.get(year);

  if (yearRole && !newUser.roles.cache.has(yearRole.base.id)) {
    u.db.sheets.roles.year.forEach(r => newRoles.delete(r.base.id));
    newRoles.set(yearRole.base.id, yearRole.base);
  }

  if (newRoles.size > 0) await newUser.roles.set(newRoles);

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

/** @param {Discord.GuildMember} sponsor */
async function createSponsorChannel(sponsor) {
  // Create the channel
  const guild = sponsor.guild;
  const channel = await guild.channels.create({
    name: `${sponsor.displayName}-hangout`,
    type: Discord.ChannelType.GuildText,
    parent: u.sf.channels.sponsorCategory,
    permissionOverwrites: [
      { id: sponsor.client.user.id, allow: ["ViewChannel"] },
      { id: guild.id, deny: ["ViewChannel"] },
      { id: sponsor.id, allow: ["ViewChannel", "ManageChannels", "ManageMessages", "ManageWebhooks"] }
    ],
    reason: "Sponsor Perk"
  });

  // Add it to the sheets database
  /** @type {import("google-spreadsheet").GoogleSpreadsheetRow} */
  let row;
  const existingRow = u.db.sheets.sponsors.rows.find(r => r.get("Sponsor") === sponsor.id);
  if (!existingRow) {
    row = await u.db.sheets.docs.config.sheetsByTitle["Sponsor Channels"].addRow({
      "Sponsor Name (Ref)": sponsor.displayName,
      Sponsor: sponsor.id,
      Channel: channel.id,
      Enabled: "TRUE"
    });
  } else {
    existingRow.set("Channel", channel.id);
    await existingRow.save();

    row = existingRow;
  }

  u.db.sheets.sponsors.set(sponsor.id, u.db.sheets.schemas.sponsors(row));
  u.db.sheets.sponsors.rows.push(row);

  // Send welcome message
  await channel.send({
    content: `${sponsor}, welcome to your private channel! Thank you for being a Pro Sponsor! Your contributions each month are very much appreciated! Please accept this channel as a token of our appreciation.\n\n` +
      "You should have some administrative abilities for this channel (including changing the name and description), as well as the ability to add people to the channel with `/sponsor invite @user`." +
      "If you would like to change default permissions for users in the channel, please contact a member of Management directly.",

    allowedMentions: { parse: ["users"] }
  }).catch((e) => u.errorHandler(e, "Couldn't send sponsor channel creation welcome"));

  // Send mod log
  const embed = u.embed({ author: sponsor })
    .setTitle("Sponsor Channel Created")
    .setDescription(`A Pro Sponsor channel was created for ${sponsor}. They have a few extra permissions there.`)
    .setColor(c.colors.info);

  await guild.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] }).catch(u.noop);

  return channel;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashManagerSponsorChannel(int) {
  const sponsor = int.options.getMember("sponsor");
  if (!sponsor) return int.reply({ content: "Sorry, I couldn't find that user.", flags: ["Ephemeral"] });
  if (!sponsor.roles.cache.hasAny(u.sf.roles.sponsors.pro, u.sf.roles.sponsors.legendary)) return int.reply({ content: `${sponsor} isn't a Pro Sponsor!`, flags: ["Ephemeral"] });

  const sponsorChannel = u.db.sheets.sponsors.get(sponsor.id)?.channel;
  if (sponsorChannel) return int.reply({ content: `Looks like ${sponsor} already has a Pro Sponsor channel at ${sponsorChannel}!`, flags: ["Ephemeral"] });

  await int.deferReply({ flags: ["Ephemeral"] });

  const channel = await createSponsorChannel(sponsor);
  await int.editReply(`Alright! ${sponsor} should be all set. Their Pro Sponsor channel (${channel}) has been created and they should be able to see it.`);
}

const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashManager,
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
      case "transfer": return slashManagerUserTransfer(int);
      case "channel": return slashManagerSponsorChannel(int);
      default: throw new Error("Unhandled Subcommand - /mgr");
    }
  }
})
.addEvent("guildMemberUpdate", async (oldMember, member) => {
  const sponsorRoles = [u.sf.roles.sponsors.pro, u.sf.roles.sponsors.legendary];
  // They recieved a pro sponsor role
  if (!oldMember.roles.cache.hasAny(...sponsorRoles) && member.roles.cache.hasAny(...sponsorRoles)) {
    const sponsorChannel = u.db.sheets.sponsors.get(member.id)?.channel;
    if (sponsorChannel) return;

    await createSponsorChannel(member);
    return;
  }
});

module.exports = Module;