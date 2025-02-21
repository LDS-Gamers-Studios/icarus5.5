// @ts-check
// ! Functions here are called in management.js. Make sure to test those calls as well
const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  u = require("../utils/utils"),
  Module = new Augur.Module();

function celebrate(test = false) {
  if (u.moment().hours() === 15 || test) {
    birthdays().catch(error => u.errorHandler(error, (test ? "Test" : "Celebrate") + "Birthdays"));
    cakedays().catch(error => u.errorHandler(error, (test ? "Test" : "Celebrate") + "Cake Days"));
  }
}


/**
 * @param {import("moment").Moment} date
 * @param {import("moment").Moment} today
 * @param {boolean} checkYear
*/
function checkDate(date, today, checkYear) {
  if (date.month() === 1 && date.date() === 29) date.subtract(1, "day");
  return date.month() === today.month() && date.date() === today.date() && (checkYear ? date.year() < today.year() : true);
}

/**
 * Provide testing parameters for testing which days work
 * @param {Date|string} [testDate] fake date
 * @param {{discordId: string, ign: string|Date}[]} [testMember] fake IGN db entry
 */
async function birthdays(testDate, testMember) {
  // Send Birthday Messages, if saved by member
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("birthDays couldn't access ldsg");
    const now = u.moment(testDate ?? new Date());

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = ["🎉", "🎊", "🎂", "🎁", "🍰"];

    const bdays = testMember ?? await u.db.ign.findMany(ldsg.members.cache.map(m => m.id), "birthday");
    const celebrating = [];
    const year = new Date().getFullYear();
    for (const birthday of bdays) {
      try {
        const date = u.moment(`${birthday.ign} ${year} 15`, "MMM D YYYY-HH");
        if (checkDate(date, now, false)) {
          const member = ldsg.members.cache.get(birthday.discordId);
          celebrating.push(member);
          const msgs = birthdayLangs.map(lang => member?.send(`${u.rand(flair)} ${lang}`));
          Promise.all(msgs).then(() => {
            member?.send("🎂 🎊 🎉 A very happy birthday to you, from LDS Gamers! 🎉 🎊 🎂").catch(u.noop);
          }).catch(u.noop);
        }
      } catch (e) {
        u.errorHandler(e, `Birthday Send - Discord ID: ${birthday.discordId}`);
        continue;
      }
    }
    if (celebrating.length > 0) {
      const embed = u.embed()
        .setTitle("Happy Birthday!")
        .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Emoji_u1f389.svg/128px-Emoji_u1f389.svg.png")
        .setDescription("Happy birthday to these fantastic people!\n\n" + celebrating.join("\n"));
      ldsg.client.getTextChannel(u.sf.channels.general)?.send({ content: celebrating.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Birthday Error"); }
}

/**
 * Add tenure roles on member cake days
 * @param {Date} [testJoinDate]
 * @param {Date} [testDate]
 * @param {Discord.Collection<string, Discord.GuildMember>} [testMember]
 */
async function cakedays(testDate, testJoinDate, testMember) {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const now = testDate ?? new Date();
    const trusted = await ldsg?.roles.fetch(u.sf.roles.moderation.trusted);
    const membersToCheck = testMember ? testMember : trusted?.members ?? [];
    /** @type {Discord.Collection<string, number>} */
    const memberPreviousJoinPeriodsAkaPrevTenure = new u.Collection();
    (await u.db.user.getUsers({ discordId: { $in: [...membersToCheck.keys()] }, priorTenure: { $gt: 0 } }))
      .forEach((value) => {
        memberPreviousJoinPeriodsAkaPrevTenure.set(value.discordId, value.priorTenure);
      });
    /** @type {Discord.Collection<Discord.Role, Discord.GuildMember[]>} */
    const cantRoleRemErrors = new u.Collection();
    /** @type {Discord.Collection<Discord.Role, Discord.GuildMember[]>} */
    const cantRoleAddErrors = new u.Collection();
    /** @type {Discord.Collection<number,Discord.GuildMember[]>} */
    const missingRoleErrors = new u.Collection();
    /** @type {Discord.GuildMember[][]} */
    const celebrating = [];
    for (const [memberId, member] of membersToCheck) {
      const joinDate = u.moment(testJoinDate ?? member.joinedAt ?? now);
      const timeSinceLastReJoin = u.moment(now).diff(joinDate, "days");
      const priorTime = memberPreviousJoinPeriodsAkaPrevTenure.get(memberId) ?? 0;// days
      const totalTime = timeSinceLastReJoin + priorTime;
      const years = Math.floor(totalTime / 365.0);
      const daysIntoThisYear = totalTime - (years * 365);
      if (daysIntoThisYear < 1 && years > 0) {
        const currentYearRole = u.db.sheets.roles.year.get(years)?.base;
        const previousYearRole = u.db.sheets.roles.year.get(years - 1)?.base;
        if (currentYearRole === undefined && years !== 0) { () => !missingRoleErrors.has(years) ? missingRoleErrors.set(years, [member]) : missingRoleErrors.get(years)?.push(member); }
        if (currentYearRole && !currentYearRole.members.has(memberId)) {
          member.roles.add(currentYearRole).catch(() => !cantRoleAddErrors.has(currentYearRole) ? cantRoleAddErrors.set(currentYearRole, [member]) : cantRoleAddErrors.get(currentYearRole)?.push(member));
          if (previousYearRole) (member.roles.remove(previousYearRole).catch(() => !cantRoleRemErrors.has(previousYearRole) ? cantRoleRemErrors.set(previousYearRole, [member]) : cantRoleRemErrors.get(currentYearRole)?.push(member)));
        }
        celebrating.length = Math.max(celebrating.length, years + 1);
        if (celebrating[years]) {
          celebrating[years].push(member);
        } else {celebrating[years] = [member];}
      }// maybe check if they have all of the year roles and such and yell at someone if they don't
      if (cantRoleAddErrors.size > 0) {cantRoleAddErrors.forEach((members, role) => u.errorHandler(new Error("Cakedays Couldn't upgrade the following members to the " + role.toString() + " Role: \n" + members.map((m) => m.toString()).join("\n"))));}
      if (cantRoleRemErrors.size > 0) {cantRoleRemErrors.forEach((members, role) => u.errorHandler(new Error("Cakedays Couldn't remove the following members from the " + role.toString() + " Role: \n" + members.map((m) => m.toString()).join("\n"))));}
      if (missingRoleErrors.size > 0) {missingRoleErrors.forEach((members, year) => u.errorHandler(new Error("Cakedays Couldn't find the Year role number " + year + " to give to these people: \n" + members.map((m) => m.toString()).join("\n"))));}
    }
    if (celebrating.length >= 1) {
      const embed = u.embed()
        .setTitle("Cake Days!")
        .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Emoji_u1f382.svg/128px-Emoji_u1f382.svg.png")
        .setDescription("The following server members are celebrating their cake days! Glad you're with us!");
      if (testDate) embed.setDescription((embed.data.description ?? "") + " (Sorry if we're a bit late!)");

      for (let years = 0; years < celebrating.length; years++) {
        const cakeMembers = celebrating[years];
        if (cakeMembers) {
          embed.addFields({ name: `${years} ${years < 1 ? "Years, First Day!!!" : years < 2 ? "Year" : "Years"}`, value: cakeMembers.join("\n") });
        }
      }
      const allMentions = [...celebrating.values()].flat().map(c => c?.toString());
      await Module.client.getTextChannel(u.sf.channels.general)?.send({ content: allMentions.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Cake Days"); }
}

Module.addEvent("ready", () => {
  celebrate();
})
  .addCommand({
    name: "bday",
    enabled: config.devMode,
    hidden: true,
    process: (msg) => {
      birthdays(new Date(), [{ discordId: msg.author.id, ign: new Date() }]);
    }
  })
  .addCommand({
    name: "cakeday",
    enabled: config.devMode,
    hidden: true,
    process: (msg, suffix) => {
      const date = u.moment();
      if (suffix) date.subtract(parseInt(suffix), "year");
      cakedays(date.toDate(), new Date(), new u.Collection().set(msg.author.id, msg.member));
    }
  })
  .setClockwork(() => {
    return setInterval(() => {
      try {
        celebrate();
      } catch (error) {
        u.errorHandler(error, "Birthday Clockwork Error");
      }
    }, 60 * 60 * 1000);
  })
  .addShared("cake.js", { cakedays, birthdays, celebrate });

module.exports = Module;