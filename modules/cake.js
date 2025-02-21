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
    cakeDays().catch(error => u.errorHandler(error, (test ? "Test" : "Celebrate") + "Cake Days"));
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
    const guild = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!guild) return;

    const now = u.moment(testDate ? testDate : undefined);

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = ["🎉", "🎊", "🎂", "🎁", "🍰"];

    const bdays = testMember ?? await u.db.ign.findMany(guild.members.cache.map(m => m.id), "birthday");
    const celebrating = [];
    const year = new Date().getFullYear();
    for (const birthday of bdays) {
      try {
        const date = u.moment(`${birthday.ign} ${year} 15`, "MMM D YYYY-HH");
        if (checkDate(date, now, false)) {
          const member = guild.members.cache.get(birthday.discordId);
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
      guild.client.getTextChannel(u.sf.channels.general)?.send({ content: celebrating.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Birthday Error"); }
}

/**
 * Add tenure roles on member cake days
 * @param {Date} [testJoinDate]
 * @param {Date} [testDate]
 * @param {Discord.Collection<string, Discord.GuildMember>} [testMember]
 */
async function cakeDays(testDate, testJoinDate, testMember) {
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
        if (currentYearRole === undefined && years !== 0) { throw new Error("It is currently " + new Date() + " and " + member.user.username + " has been here " + years + " years and there isn't a role for them."); }
        if (currentYearRole && !currentYearRole.members.has(memberId)) {
          member.roles.add(currentYearRole).catch(() => u.errorHandler(new Error("Cakedays Couldn't upgrade <@" + member + "> to the " + currentYearRole.toString() + " Role")));
          if (previousYearRole) (member.roles.remove(previousYearRole).catch(() => u.errorHandler(new Error("Cakedays Couldn't remove <@" + member + "> from their old " + previousYearRole.toString() + " Role"))));
        }
        celebrating.length = Math.max(celebrating.length, years + 1);
        if (celebrating[years]) {
          celebrating[years].push(member);
        } else {celebrating[years] = [member];}
      }// maybe check if they have all of the year roles and such and yell at someone if they don't
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
      birthdays([{ discordId: msg.author.id, ign: new Date() }], new Date());
    }
  })
  .addCommand({
    name: "cakeday",
    enabled: config.devMode,
    hidden: true,
    process: (msg, suffix) => {
      const date = u.moment();
      if (suffix) date.subtract(parseInt(suffix), "year");
      cakeDays(date.toDate(), new Date(), new u.Collection().set(msg.author.id, msg.member));
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
  .addShared("cake.js", { cakeDays, birthdays, celebrate });

module.exports = Module;