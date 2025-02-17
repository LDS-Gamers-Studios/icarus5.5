// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  u = require("../utils/utils"),
  Module = new Augur.Module();

function celebrate() {
  if (u.moment().hours() === 15) {
    testBirthdays().catch(error => u.errorHandler(error, "Test Birthdays"));
    testCakeDays().catch(error => u.errorHandler(error, "Test Cake Days"));
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
 * @param {{discordId: string, ign: string|Date}[]} [testMember] fake IGN db entry
 * @param {Date|string} [testDate] fake date
 */
async function testBirthdays(testMember, testDate) {
  // Send Birthday Messages, if saved by member
  try {
    const guild = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!guild) return;

    const now = u.moment(testDate ? new Date(testDate) : undefined);

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = [
      ":tada: ",
      ":confetti_ball: ",
      ":birthday: ",
      ":gift: ",
      ":cake: "
    ];

    const birthdays = testMember ?? await u.db.ign.findMany(guild.members.cache.map(m => m.id), "birthday");
    const celebrating = [];
    for (const birthday of birthdays) {
      try {
        const date = u.moment(new Date(birthday.ign + " 5:PM"));
        if (checkDate(date, now, false)) {
          const member = guild.members.cache.get(birthday.discordId);
          celebrating.push(member);
          const msgs = birthdayLangs.map(lang => member?.send(u.rand(flair) + lang));
          Promise.all(msgs).then(() => {
            member?.send(":birthday: :confetti_ball: :tada: A very happy birthday to you, from LDS Gamers! :tada: :confetti_ball: :birthday:").catch(u.noop);
          }).catch(u.noop);
        }
      } catch (e) { u.errorHandler(e, `Birthday Send - Discord ID: ${birthday.discordId}`); continue; }
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
 * Provide testing parameters for testing which days work
 * @param {Date} [testJoinDate]
 * @param {Date} [testDate]
 * @param {Discord.Collection<string, Discord.GuildMember>} [testMember]
 */
async function testCakeDays(testJoinDate, testDate, testMember) {
  // Add tenure roles on member cake days

  try {
    const guild = Module.client.guilds.cache.get(u.sf.ldsg);
    const now = u.moment(testDate);
    if (!guild) return u.errorHandler(new Error("LDSG is unavailable???"));

    const members = testMember ?? await guild.members.fetch().catch(u.noop) ?? guild.members.cache;
    const offsets = testJoinDate ? [] : await u.db.user.getUsers({ discordId: { $in: [...members.keys()] }, priorTenure: { $gt: 0 } });

    /** @type {Discord.Collection<number, Discord.GuildMember[]>} */
    const celebrating = new u.Collection();

    const unknownYears = new Set();
    const unapplied = [];
    for (const [memberId, member] of members.filter(m => m.roles.cache.has(u.sf.roles.moderation.trusted))) {
      try {
        const offset = offsets.find(o => o.discordId === memberId);
        const join = u.moment(testJoinDate ?? member.joinedAt ?? 0).subtract(offset?.priorTenure || 0, "days");
        if (checkDate(join, now, true)) {
          const years = now.year() - join.year();
          // yell at devs if not
          const role = u.db.sheets.roles.year.get(years);
          if (role) {
            const oldRole = u.db.sheets.roles.year.find(r => member.roles.cache.has(r.base.id) && r.base.id !== role.base.id);
            const roles = member.roles.cache.clone();
            if (oldRole) roles.delete(oldRole.base.id);
            await member.roles.set([...roles.keys(), role.base.id]).catch(e => {
              u.errorHandler(e, `Tenure Role Set (${member.displayName} - ${memberId})`);
              // eslint-disable-next-line no-console
              console.log([...roles.keys(), role.base.id]);
            });
          } else {
            unknownYears.add(years);
            unapplied.push(member);
          }
          if (celebrating.has(years)) celebrating.get(years)?.push(member);
          else celebrating.set(years, [member]);
        }
      } catch (e) { u.errorHandler(e, `Announce Cake Day Error (${member.displayName} - ${memberId})`); continue; }
    }
    if (unknownYears.size > 0) {
      Module.client.getTextChannel(u.sf.channels.botTesting)?.send(`## ⚠️ Cakeday Manual Fix\n I couldn't find the role IDs for the following cakeday year(s): ${[...unknownYears].join(", ")}\nAre they in the google sheet with the type set to \`Year\`?\nThe following members need the role(s) given manually. ${unapplied.join(", ")}`);
    }
    if (celebrating.size > 0) {
      const embed = u.embed()
      .setTitle("Cake Days!")
      .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Emoji_u1f382.svg/128px-Emoji_u1f382.svg.png")
      .setDescription("The following server members are celebrating their cake days! Glad you're with us!");
      for (const [years, cakeMembers] of celebrating.sort((v1, v2, k1, k2) => k2 - k1)) {
        embed.addFields({ name: `${years} ${years > 1 ? "Years" : "Year"}`, value: cakeMembers.join("\n") });
      }
      const allMentions = [...celebrating.values()].flat().map(c => c.toString());
      await guild.client.getTextChannel(u.sf.channels.general)?.send({ content: allMentions.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Cake Days"); }
}

Module.addEvent("ready", () => {
  celebrate();
})
// Janky stuff, but it works!!! (for now lol)
.setUnload((date, type) => {
  if (type === "cake") testCakeDays(undefined, date);
  else if (type === "bday") testBirthdays(undefined, date);
})
.addCommand({ name: "bday",
  permissions: () => config.devMode,
  hidden: true,
  process: (msg) => {
    testBirthdays([{ discordId: msg.author.id, ign: new Date() }], new Date());
  }
})
.addCommand({ name: "cakeday",
  permissions: () => config.devMode,
  hidden: true,
  process: (msg, suffix) => {
    const date = u.moment();
    if (suffix) date.subtract(parseInt(suffix), "year");
    testCakeDays(date.toDate(), new Date(), new u.Collection().set(msg.author.id, msg.member));
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
});

module.exports = Module;
