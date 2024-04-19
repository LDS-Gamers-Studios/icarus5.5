// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  mo = require("moment"),
  u = require("../utils/utils");
const { GoogleSpreadsheet } = require("google-spreadsheet");


/**
 * Get time in MST
 * @param {mo.MomentInput} [inp]
 * @param {boolean} [strict]
 */
const moment = (inp, strict) => mo(inp, strict).utcOffset(-7);


function celebrate() {
  if (moment().hours() == 15) {
    testBirthdays().catch(error => u.errorHandler(error, "Test Birthdays"));
    testCakeDays().catch(error => u.errorHandler(error, "Test Cake Days"));
  }
}

/** @type {Discord.Collection<number, string>} */
let tenureCache = new u.Collection();

/**
 * @param {mo.Moment} date
 * @param {mo.Moment} today
 * @param {boolean} checkYear
*/
function checkDate(date, today, checkYear) {
  if (date.month() == 1 && date.date() == 29) date.subtract(1, "day");
  return date.month() == today.month() && date.date() == today.date() && (checkYear ? date.year() < today.year() : true);
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

    const now = moment(testDate ? new Date(testDate) : undefined);

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = [
      ":tada: ",
      ":confetti_ball: ",
      ":birthday: ",
      ":gift: ",
      ":cake: "
    ];

    const birthdays = testMember ?? (await u.db.ign.getList("birthday")).filter(ign => guild.members.cache.has(ign.discordId));
    const celebrating = [];
    for (const birthday of birthdays) {
      try {
        const date = moment(new Date(birthday.ign));
        if (checkDate(date, now, false)) {
          const member = guild.members.cache.get(birthday.discordId);
          celebrating.push(member);
          const msgs = birthdayLangs.map(lang => member?.send(u.rand(flair) + lang));
          Promise.all(msgs).then(() => {
            member?.send(":birthday: :confetti_ball: :tada: A very happy birthday to you, from LDS Gamers! :tada: :confetti_ball: :birthday:").catch(u.noop);
          }).catch(u.noop);
        }
      } catch (e) { u.errorHandler(e, `Birthday Send - Discord Id: ${birthday.discordId}`); continue; }
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
    const now = moment(testDate);
    if (!guild) return u.errorHandler(new Error("LDSG is unavailable???"));

    const members = testMember ?? await guild.members.fetch();
    const offsets = testJoinDate ? [] : await u.db.user.getUsers({ discordId: { $in: [...members.keys()] }, priorTenure: { $gt: 0 } });

    /** @type {Discord.Collection<number, Discord.GuildMember[]>} */
    const celebrating = new u.Collection();

    const unknownYears = new Set();
    const unapplied = [];
    for (const [memberId, member] of members.filter(m => m.roles.cache.has(u.sf.roles.trusted))) {
      try {
        const offset = offsets.find(o => o.discordId == memberId);
        const join = moment(testJoinDate ?? member.joinedAt ?? 0).subtract(offset?.priorTenure || 0, "days");
        if (checkDate(join, now, true)) {
          const years = now.year() - join.year();
          // yell at management if not
          if (tenureCache.has(years)) {
            const roles = tenureCache.clone();
            roles.delete(years);
            await member.roles.remove([...roles.values()]).catch(e => u.errorHandler(e, `Tenure Role Remove (${member.displayName} - ${memberId})`));
            await member.roles.add(tenureCache.get(years) ?? "").catch(e => u.errorHandler(e, `Tenure Role Add (${member.displayName} - ${memberId})`));
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
      const content = `## ⚠️ Cakeday Manual Fix\n I couldn't find the role IDs for the following cakeday year(s): ${[...unknownYears].join(", ")}\nAre they in the google sheet with a valid local id?\nThe following members need the role given manually. ${unapplied.join(", ")}`;
      Module.client.getTextChannel(u.sf.channels.management)?.send(content + "\nI've also notified the bot team, please work with them on fixing this issue.");
      Module.client.getTextChannel(u.sf.channels.bottesting)?.send(content);
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

const Module = new Augur.Module()
.addEvent("ready", () => {
  // Populate tenureCache
  const guild = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!guild) return;
  const exp = /^Member - (\d+) Years?$/;
  const roles = guild.roles.cache.filter(r => exp.test(r.name));

  for (const [roleId, role] of roles) {
    const match = exp.exec(role.name);
    if (!match) continue;
    tenureCache.set(parseInt(match[1], 10), roleId);
  }

  celebrate();
})
.setInit(async () => {
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    /** @type {any[]} */
    // @ts-ignore cuz google sheets be dumb
    const roles = await doc.sheetsByTitle["Roles"].getRows();

    const a = roles.filter(r => r["Local ID"]?.startsWith("YR")).map(r => {
      return {
        year: parseInt(r["Level"]),
        role: r["Base Role ID"],
      };
    });

    tenureCache = new u.Collection(a.map(r => [r.year, r.role]));
  } catch (e) {
    u.errorHandler(e, "Cakeday Init");
  }
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
    const date = new Date();
    if (suffix) date.setFullYear(parseInt(suffix));
    testCakeDays(date, new Date(), new u.Collection().set(msg.author.id, msg.member));
  }
})
// @ts-ignore its an augur thing im too lazy to fix
.setClockwork(() => {
  try {
    return setInterval(celebrate, 60 * 60 * 1000);
  } catch (e) { u.errorHandler(e, "Birthday Clockwork Error"); }
});

module.exports = Module;
