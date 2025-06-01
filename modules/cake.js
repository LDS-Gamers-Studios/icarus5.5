// @ts-check
// ! Functions here are called in management.js. Make sure to test those calls as well
const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  u = require("../utils/utils"),
  Module = new Augur.Module();

function celebrate(test = false) {
  if (u.moment().hours() === 15 || test) {
    birthdays().catch(error => u.errorHandler(error, (test ? "Test" : "Celebrate") + " Birthdays"));
    cakedays().catch(error => u.errorHandler(error, (test ? "Test" : "Celebrate") + " Cake Days"));
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
    if (!ldsg) throw new Error("Birthdays couldn't access LDSG");

    const now = u.moment(testDate ?? new Date());

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = ["🎉", "🎊", "🎂", "🎁", "🍰"];

    const bdays = testMember ?? await u.db.ign.findMany(ldsg.members.cache.map(m => m.id), "birthday");

    /** @type {(Discord.GuildMember | undefined)[]} */
    const celebrating = [];
    const year = new Date().getFullYear();
    for (const birthday of bdays) {
      try {
        const date = u.moment(`${birthday.ign} ${year}-15`, "MMM D YYYY-HH");
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
    const now = u.moment(testDate) ?? u.moment();

    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const trusted = await ldsg?.roles.fetch(u.sf.roles.moderation.trusted);
    const membersToCheck = testMember ?? trusted?.members ?? new u.Collection();

    const priorTenures = await u.db.user.getUsers({ discordId: { $in: [...membersToCheck.keys()] }, priorTenure: { $gt: 0 } })
      .then((rawresults) => {
        return new u.Collection(rawresults.map((value) => [value.discordId, value.priorTenure]));
      });

    /** @type {Discord.Collection<number, Discord.GuildMember[]>} */
    const missingRoleErrors = new u.Collection();
    /** @type {Discord.Collection<number, Discord.GuildMember[]>} */
    const cantRoleSetErrors = new u.Collection();

    /** @type {Discord.Collection<number, Discord.GuildMember[]>} */
    const celebrating = new u.Collection();

    for (const [memberId, member] of membersToCheck) {
      const joinDate = u.moment(testJoinDate ?? member.joinedAt);
      if (!joinDate.isValid()) {
        continue;
      }

      // this moves back the join date to simulate them having joined earlier to account for their prior tenure
      joinDate.subtract(priorTenures.get(memberId) ?? 0, "days");

      if (checkDate(joinDate, now, true)) {
        const years = Math.round(now.diff(joinDate, "years", true));
        celebrating.ensure(years, () => []).push(member);

        const currentYearRole = u.db.sheets.roles.year.get(years)?.base;
        if (!currentYearRole) {
          missingRoleErrors.ensure(years, () => []).push(member);
          continue;
        }

        const userRoles = member.roles.cache.clone();
        const previousYearRoles = u.db.sheets.roles.year.filter(r => userRoles.has(r.base.id));

        for (const role of previousYearRoles.values()) {
          userRoles.delete(role.base.id);
        }

        userRoles.set(currentYearRole.id, currentYearRole);

        await member.roles.set(userRoles).catch(() => {
          cantRoleSetErrors.ensure(years, () => []).push(member);
        });
      }
    }

    // yell at the devs
    cantRoleSetErrors.forEach((members, year) =>
      u.errorHandler(new Error(`Cakedays - Couldn't upgrade the following members ${year > 1 ? `from the ${year - 1} year role ` : ""}to the ${year} year role`), members.join("\n"))
    );
    missingRoleErrors.forEach((members, year) =>
      u.errorHandler(new Error(`Cakedays - Couldn't find the year role for ${year} year(s)`), members.join("\n"))
    );

    if (celebrating.size > 0) {
      const embed = u.embed()
        .setTitle("Cake Days!")
        .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Emoji_u1f382.svg/128px-Emoji_u1f382.svg.png")
        .setDescription("The following server members are celebrating their cake days! Glad you're with us!");

      if (testDate) embed.setDescription((embed.data.description ?? "") + " (Sorry if we're a bit late!)");

      celebrating.sort((a, b, y1, y2) => y2 - y1);

      for (const [years, cakeMembers] of celebrating) {
        embed.addFields({
          name: `${years} ${years < 1 ? "Years, First Day!!!" : years < 2 ? "Year" : "Years"}`,
          value: cakeMembers.join("\n")
        });
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
      birthdays(new Date(), [{ discordId: msg.author.id, ign: u.moment().format("MMM D YYYY-HH") }]);
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
  .setShared({ cakedays, birthdays, celebrate });

/** @typedef {{ cakedays: cakedays, birthdays: birthdays, celebrate: celebrate } | undefined} Shared */

module.exports = Module;