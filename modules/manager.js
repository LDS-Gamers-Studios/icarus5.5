// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const Rank = require("../utils/rankInfo");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const fs = require("fs");

const Module = new Augur.Module();

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

async function getHouseStats(resetting = false) {
  const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't find LDSG");

  const date = resetting ? u.moment().subtract(4, "months") : undefined;
  const report = await u.db.user.getReport(ldsg.members.cache.map(m => m.id), date);

  const houseMap = new u.Collection([
    [u.sf.roles.houses.housesc, "sc"],
    [u.sf.roles.houses.housebb, "bb"],
    [u.sf.roles.houses.housefb, "fb"]
  ]);

  const points = houseMap.map((shorthand, roleId) => {
    const houseRole = ldsg.roles.cache.get(roleId);
    const members = houseRole?.members ?? new u.Collection();

    const houseReport = report
      .filter(a => members.has(a.discordId))
      .reduce((p, cur) => ({ em: p.em + cur.em, xp: p.xp + cur.currentXP }), { em: 0, xp: 0 });

    return {
      roleId,
      name: houseRole?.name ?? "Unknown House",
      embers: houseReport.em,
      xp: houseReport.xp,
      perCapita: houseReport.em / (members.size || 1),
      // @ts-ignore
      emoji: u.sf.emoji.houses[shorthand],
      shorthand
    };
  });
  return points;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashManagerRankHouseEmber(interaction) {
  try {
    await interaction.deferReply({ flags: ["Ephemeral"] });
    const points = await getHouseStats();

    const medals = ["🥇", "🥈", "🥉"];
    const emoji = `<:ember:${u.sf.emoji.ember}>`;

    points.sort((a, b) => b.perCapita - a.perCapita);

    const perCapitaSorted = points.map((house, i) => `${medals[i]} **${house.name}:** ${emoji}${house.perCapita.toFixed(2)} (${emoji}${house.embers} total)`).join("\n");

    points.sort((a, b) => b.xp - a.xp);
    const xpSorted = points.map((house, i) => `${medals[i]} **${house.name}:** ${house.xp}`).join("\n");

    const embed = u.embed().setTitle("Season House Points")
      .setDescription("Current standings of the houses (Ember awards on a *per capita* basis):\n" + perCapitaSorted + "\n\n XP per house:\n" + xpSorted);

    interaction.editReply({ embeds: [embed] });
  } catch (e) {
    u.errorHandler(e, interaction);
  }
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

/**
 * @param {Discord.Client<true>} client
 * @param {string} [time]
 */
async function getMopBucketWinner(client, time) {
  const lastSeason = u.moment(time).startOf("month").subtract(4, "months").hour(19);

  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't find LDSG - Rank Reset");

  const houseStats = await getHouseStats(true);

  const medals = ["🥇", "🥈", "🥉"];

  houseStats.sort((a, b) => b.embers - a.embers);
  const perHouse = houseStats.map((house, i) => `${medals[i]} **${house.name}:** ${house.embers.toFixed(2)}`).join("\n");

  houseStats.sort((a, b) => b.perCapita - a.perCapita);
  const perCapita = houseStats.map((house, i) => `${medals[i]} **${house.name}:** ${house.perCapita.toFixed(2)}`).join("\n");

  const winner = houseStats[0];
  const emoji = `<:${winner.shorthand}:${winner.emoji}>`;

  const publicString = "And now, for the winner of this season's **House Mop Bucket!!!**\n\n" +
    "This season's mop bucket goes to...\ndrumroll please...\n\n" +
    `# ${emoji} ${winner.name.toUpperCase()}!!! ${emoji}\n` +
    "-# Wow, incredible!\n\n" +
    `Congrats to all of you ${winner.name}-ers out there! Your house crest will be the server banner for a while, plus you get insane bragging rights!`;

  const privateEmbed = u.embed()
    .setTitle(`House Points Since ${lastSeason.format("MMMM Do")}`)
    .setDescription("Final standings of the houses this season (*decided by per capita*):\n\nPer Capita:\n" + perCapita + "\n\nPer House:\n" + perHouse);

  return { publicString, privateEmbed, house: winner };
}

/** @param {Discord.Client<true>} client  */
async function rankReset(client, dist = 10_000) {
  const ember = `<:ember:${u.sf.emoji.ember}>`;
  dist = Math.abs(dist);

  // get people who opted in to xp
  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("No LDSG - Rank Reset");

  const members = await ldsg.members.fetch().then(mems => mems.map(m => m.id));
  const users = await u.db.user.getUsers({ currentXP: { $gt: 0 }, discordId: { $in: members } });

  // log for backup
  const date = u.moment().format("MM DD YYYY");
  fs.writeFileSync(`./data/rankDetail ${date}-.json`, JSON.stringify(users.map(usr => ({ discordId: usr.discordId, currentXP: usr.currentXP }))));

  // formula for ideal ember distribution
  const totalXP = users.reduce((p, cur) => p + cur.currentXP, 0);
  const rate = dist / totalXP;

  // top performers
  const medals = ["🥇", "🥈", "🥉"];
  const top3 = users.sort((a, b) => b.currentXP - a.currentXP)
    .slice(0, 3)
    .map((usr, i) => `${medals[i]} - <@${usr.discordId}> (${usr.currentXP} XP)`)
    .join("\n");

  const team = client.getTextChannel(u.sf.channels.team.team);
  await team?.send(`Here are the stats for this season:\nParticipants: ${users.length}\nTotal XP: ${totalXP}\nRate: ${rate}\n\nTop 3:\n${top3}`);

  if (dist) {
    // generate CSV backup
    const rewardRows = ["id,season,life,award"];

    /** @type {import("../database/controllers/bank").CurrencyRecord[]} */
    const records = [];

    for (const user of users) {
      const award = Math.round(rate * user.currentXP);
      if (award) {
        rewardRows.push(`${user.discordId},${user.currentXP},${user.totalXP},${award}`);
        records.push({
          currency: "em",
          description: `Chat Rank Reset - ${new Date().toLocaleDateString()}`,
          discordId: user.discordId,
          value: award,
          otherUser: client.user.id ?? "Icarus",
          hp: true,
          timestamp: new Date()
        });
      }

      fs.writeFileSync(`./data/awardDetail ${date}.csv`, rewardRows.join("\n"));
      if (records.length > 0) await u.db.bank.addManyTransactions(records);
    }
  }

  // announce!
  let announcement = "# CHAT RANK RESET!!!\n\n" +
    `Another chat season has come to a close! In the most recent season, we've had **${users.length}** active members who are tracking their chatting XP! Altogether, we earned **${totalXP} XP!**\n` +
    `The three most active members were:\n${top3}\n\n` +
    dist ? `${ember}${dist} have been distributed among *all* of those ${users.length} XP trackers, proportional to their participation.\n\n` : "" +
    "If you would like to participate in this season's chat ranks and *haven't* opted in, `/rank track` will get you in the mix. If you've previously used that command, you don't need to do so again.";

  const mopBucket = await getMopBucketWinner(client);
  announcement += `\n\n${mopBucket.publicString}`;

  /** @type {import("./management").ManagementShared | undefined} */
  const managementShared = await client.moduleManager.shared.get("management.js");
  if (!managementShared) throw new Error("Couldn't access banner set function");

  managementShared.setBanner(`house-${mopBucket.house.shorthand}`);

  client.getTextChannel(u.sf.channels.announcements)?.send({ content: announcement, allowedMentions: { parse: ["users"] } });
  team?.send({ embeds: [mopBucket.privateEmbed] });

  // set everyone's xp back to 0
  u.db.user.resetSeason();
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashManagerRankReset(int) {
  try {

    const confirmation = await u.confirmInteraction(int, "Are you sure you want to reset the Season?\n**This will reset everyone's XP to 0.**", "Confirmation:");
    if (!confirmation) return;

    // Dist should be 10_000 for a normal season length
    const dist = int.options.getInteger("ember-reward", false) ?? 10_000;
    await rankReset(int.client, dist);

    return confirmation.editReply({ content: "The season has been reset." });
  } catch (error) {
    u.errorHandler(error, int);
  }
}

Module.addInteraction({
  id: u.sf.commands.slashManager,
  onlyGuild: true,
  options: { registry: "slashManager" },
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
      case "transfer": return slashManagerUserTransfer(int);
      case "channel": return slashManagerSponsorChannel(int);
      case "reset": return slashManagerRankReset(int);
      case "house-report": return slashManagerRankHouseEmber(int);
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
})
.setShared({ rankReset });

/** @typedef {{ rankReset: rankReset }} ManagerShared */

module.exports = Module;