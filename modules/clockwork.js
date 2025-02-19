// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");

const testDmRow = u.MessageActionRow()
  .addComponents(new u.Button().setCustomId("testDMs").setLabel("Test DM").setStyle(Discord.ButtonStyle.Primary));

/** @type {import("../database/controllers/reminder").Timer[]} */
let reminders = [];

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashClockworkTimer(int) {
  const days = int.options.getInteger("days");
  const hours = int.options.getInteger("hours");
  const minutes = int.options.getInteger("minutes");
  const textForm = `${days ? ` ${days} day` : ""}${hours ? ` ${hours} hour` : ""}${minutes ? ` ${minutes} minute` : ""}`;
  const reminder = int.options.getString("timer-text") ?? `Your${textForm} timer is up!`;

  if (!days && !hours && !minutes) return int.reply({ content: "Your timer is up! (you need to give me a delay!)", flags: ["Ephemeral"] });

  
  await int.deferReply();

  const timestamp = u.moment();
  if (days) timestamp.add(days, "days");
  if (hours) timestamp.add(hours, "hours");
  if (minutes) timestamp.add(minutes, "minutes");

  const rem = await u.db.reminder.save({
    discordId: int.user.id,
    reminder,
    timestamp: timestamp.valueOf(),
    started: u.moment().valueOf(),
    isTimer: true
  });
  reminders.push(rem);
  let content = `I set a${textForm} timer! Once it's up, i'll send you this message:` +
    `\`${reminder}\`\n` +
    "Click the button below if you're not sure if you can receive DMs from me.";
  if (!days && !hours && minutes && minutes < 30) content += "\n(By the way, I run in intervals of 5 minutes, so it may not be super accurate.)";
  await int.editReply({ content, components: [testDmRow] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashClockworkReminder(int) {
  const reminder = int.options.getString("reminder-text", true);
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const year = int.options.getInteger("year") ?? u.moment().get("year");
  const time = int.options.getString("time") ?? u.moment().format("h:mm a");

  const timeRegex = /(\d?\d):(\d\d) ?(am|pm)?/i.exec(time);
  if (!timeRegex) return int.reply({ content: "Sorry, I couldn't understand that time format! Try `XX:XX AM/PM`.", flags: ["Ephemeral"] });

  let hour = parseInt(timeRegex[1]);
  const minutes = timeRegex[2];
  const m = timeRegex[3];
  if (m?.toLowerCase() === "pm") hour = Math.min(hour + 12, 24);
  const timestamp = u.moment(`${year}-${month}-${day.toString().padStart(2, "0")} ${hour.toString().padStart(2, "0")}:${minutes}`);
  if (!timestamp.isValid()) return int.reply({ content: "Sorry, I couldn't understand that date!", flags: ["Ephemeral"] });
  if (timestamp.isSameOrBefore(u.moment(), "minute")) return int.reply({ content: "Sorry, I can't go back in time to send you a reminder.", flags: ["Ephemeral"] });

  await int.deferReply({ ephemeral: true });

  const rem = await u.db.reminder.save({
    discordId: int.user.id,
    reminder,
    timestamp: timestamp.valueOf(),
    started: u.moment().valueOf(),
    isTimer: false
  });
  reminders.push(rem);

  const content = `I'll remind you the following at ${toTime(timestamp)}:\n` +
    `\`${reminder}\`\n` +
    "Click the button below if you're not sure if you can receive DMs from me.";
  await int.editReply({ content, components: [testDmRow] });
}

/**
 * @param {number|import("moment").Moment} num
 * @param {Discord.TimestampStylesString} [dec]
*/
function toTime(num, dec = "f") {
  if (typeof num === "number") return u.time(new Date(num), dec);
  return u.time(num.toDate(), dec);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashClockworkCancel(int) {
  const inputId = int.options.getString("id");
  await int.deferReply({ ephemeral: true });
  if (!inputId) {
    const pending = await u.db.reminder.fetchUser(int.user.id);
    if (pending.length === 0) return int.editReply("Looks like you don't have any pending timers or reminders!");
    const lines = pending.map(p => {
      const decorator = p.isTimer ? "⏱️" : "📆";
      return `${decorator} ${toTime(p.timestamp)}\n` +
        `ID: **${p.id}**\nNote: \`${p.reminder}\`\n` +
        `-# Requested ${toTime(p.started, "R")}\n`;
    });
    const embed = u.embed().setTitle("Pending Timers/Reminders");
    return u.pagedEmbeds(int, embed, lines, true);
  }
  const deleted = await u.db.reminder.deleteById(inputId, int.user.id);
  if (!deleted) return int.editReply("Sorry, I couldn't find that one!");
  return int.editReply(`I deleted the ${deleted.isTimer ? "timer" : "reminder"} for ${toTime(deleted.timestamp)}\nYour note: \`${deleted.reminder}\``);
}

/** @param {Discord.Client} client */
async function timerCheck(client) {
  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];
    if (reminder.timestamp <= Date.now()) {
      try {
        const user = client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(reminder.discordId);
        if (user) {
          const embed = u.embed()
            .setTitle(reminder.isTimer ? "TIMER ENDED" : "REMINDER")
            .setDescription(reminder.reminder)
            .addFields({
              name: reminder.isTimer ? "Timer started on" : "Reminder requested on",
              value: toTime(reminder.timestamp)
            });
          user.send({ embeds: [embed] }).catch(u.noop);
        }
      } catch (error) {
        u.errorHandler(error, `Execute Reminder ${reminder.id}`);
      }
      await u.db.reminder.deleteById(reminder.id, reminder.discordId);
      reminders.splice(i, 1);
    }
  }
}
const Module = new Augur.Module();
Module.addInteraction({
  id: u.sf.commands.slashClockwork,
  onlyGuild: true,
  process: async (int) => {
    switch (int.options.getSubcommand(true)) {
      case "timer": return slashClockworkTimer(int);
      case "reminder": return slashClockworkReminder(int);
      case "cancel": return slashClockworkCancel(int);
      default: u.errorHandler(new Error("Unhandled Subcommand - Clockwork"), int);
    }
  }
})
.addInteraction({
  id: "testDMs",
  type: "Button",
  onlyGuild: true,
  process: async (int) => {
    await int.deferReply({ ephemeral: true });
    const m = await int.member.send("Here's a test DM!").catch(u.noop);

    if (m) return int.editReply("I sent you a DM and I'm pretty sure it went through!");
    return int.editReply("I couldn't send you a DM! Check your privacy settings or try sending me a DM.");
  }
})
.setClockwork(() => {
  return setInterval(() => {
    timerCheck(Module.client);
  }, 5 * 60_000);
})
.setInit(async () => {
  reminders = await u.db.reminder.fetchAll();
  timerCheck(Module.client);
});

module.exports = Module;