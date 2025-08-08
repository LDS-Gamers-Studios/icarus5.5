// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");

const MONTH_THRESHOLD = 6;

const testDmRow = u.MessageActionRow()
  .addComponents(new u.Button().setCustomId("testDMs").setLabel("Test DM").setStyle(Discord.ButtonStyle.Primary));

/** @type {import("../database/controllers/reminder").Timer[]} */
let reminders = [];

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashClockworkTimer(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  const days = int.options.getInteger("days");
  const hours = int.options.getInteger("hours");
  const minutes = int.options.getInteger("minutes");

  const textFormArray = [];
  if (days) textFormArray.push(`${days} day`);
  if (hours) textFormArray.push(`${hours} hour`);
  if (minutes) textFormArray.push(`${minutes} minute`);

  const textForm = textFormArray.join(", ");
  const reminderText = int.options.getString("timer-text") ?? `Your ${textForm} timer is up!`;

  if (!days && !hours && !minutes) return int.editReply("Your timer is up! (you need to give me a delay!)");


  const timestamp = u.moment();
  if (days) timestamp.add(days, "days");
  if (hours) timestamp.add(hours, "hours");
  if (minutes) timestamp.add(minutes, "minutes");

  const reminder = await u.db.reminder.save({
    discordId: int.user.id,
    reminder: reminderText,
    timestamp: timestamp.valueOf(),
    started: u.moment().valueOf(),
    isTimer: true
  });

  if (!timestamp.isAfter(u.moment().add(MONTH_THRESHOLD, "months"))) reminders.push(reminder);

  const content = `I set a ${textForm} timer! Once it's up, I'll send you this message: ` +
    `\`${reminderText}\`\n` +
    "Click the button below if you're not sure if you can receive DMs from me.";
  await int.editReply({ content, components: [testDmRow] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashClockworkReminder(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  const reminderText = int.options.getString("reminder-text", true);
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const yearInput = int.options.getInteger("year");
  const year = yearInput || u.moment().get("year");

  const time = int.options.getString("time") ?? u.moment().format("h:mm a");

  // parse the time (XX:XX AM/PM format)
  const timeRegex = /(\d?\d):(\d\d) ?(am|pm)?/i.exec(time);
  if (!timeRegex) return int.editReply("Sorry, I couldn't understand that time format! Try `XX:XX AM/PM`.");

  const amPm = timeRegex[3]?.toLowerCase();
  let hour = parseInt(timeRegex[1]);
  if (hour === 12 && amPm === "am") hour = 0;
  else if (hour !== 12 && amPm === "pm") hour = Math.min(hour + 12, 24);

  const minutes = timeRegex[2];
  const timestamp = u.moment(`${year}-${month}-${day.toString().padStart(2, "0")}`);
  timestamp.hour(hour).minute(parseInt(minutes));
  if (!timestamp.isValid()) return int.editReply("Sorry, I couldn't understand that date!");

  if (!yearInput && timestamp.isBefore(u.moment(), "month")) timestamp.add(1, "year");
  if (timestamp.isSameOrBefore(u.moment(), "minute")) return int.editReply("Sorry, I can't go back in time to send you a reminder.");

  const reminder = await u.db.reminder.save({
    discordId: int.user.id,
    reminder: reminderText,
    timestamp: timestamp.valueOf(),
    started: u.moment().valueOf(),
    isTimer: false
  });

  if (!timestamp.isAfter(u.moment().add(MONTH_THRESHOLD, "months"))) reminders.push(reminder);

  const content = `I'll remind you the following at ${toTime(timestamp)}:\n` +
    `\`${reminderText}\`\n` +
    "Click the button below if you're not sure if you can receive DMs from me.";
  await int.editReply({ content, components: [testDmRow] });
}

/**
 * @param {number|import("moment").Moment|Date} num
 * @param {Discord.TimestampStylesString} [dec]
*/
function toTime(num, dec = "f") {
  if (typeof num === "number") return u.time(new Date(num), dec);
  if (num instanceof Date) return u.time(num, dec);
  return u.time(num.toDate(), dec);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashClockworkCancel(int) {
  const inputId = int.options.getString("id");
  await int.deferReply({ flags: ["Ephemeral"] });

  if (inputId) {
    const deleted = await u.db.reminder.deleteById(inputId, int.user.id);
    if (!deleted) return int.editReply("Sorry, I couldn't find that one!");
    return int.editReply(`I deleted the ${deleted.isTimer ? "timer" : "reminder"} for ${toTime(deleted.timestamp)}\nYour note: \`${deleted.reminder}\``);
  }

  const pending = await u.db.reminder.fetchUser(int.user.id);
  if (pending.length === 0) return int.editReply("Looks like you don't have any pending timers or reminders!");

  const lines = pending.map(p => {
    const decorator = p.isTimer ? "⏱️" : "📆";
    return `${decorator} ${toTime(p.timestamp)}\n` +
      `ID: **${p.id}**\nNote: \`${p.reminder}\`\n` +
      `-# Requested ${toTime(p.started, "R")}\n`;
  });

  const embed = u.embed().setTitle("Pending Timers/Reminders");
  const embeds = u.pagedEmbedsDescription(embed, lines);
  return u.manyReplies(int, embeds.map(e => ({ embeds: [e] })), true);
}

/** @param {Discord.Client} client */
async function timerCheck(client) {
  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];
    if (reminder.timestamp > Date.now()) continue;

    const user = client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(reminder.discordId);
    if (user) {
      const embed = u.embed()
        .setTitle(reminder.isTimer ? "TIMER ENDED" : "REMINDER")
        .setDescription(reminder.reminder)
        .addFields({ name: reminder.isTimer ? "Timer started on" : "Reminder requested on", value: toTime(reminder.started) });

      user.send({ embeds: [embed] }).catch(u.noop);
    }

    await u.db.reminder.deleteById(reminder.id, reminder.discordId);
    reminders.splice(i, 1);
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
    await int.deferReply({ flags: ["Ephemeral"] });
    const m = await int.member.send("Here's a test DM!").catch(u.noop);

    if (m) return int.editReply("I sent you a DM and I'm pretty sure it went through!");
    return int.editReply("I couldn't send you a DM! Check your privacy settings or try sending me a DM.");
  }
})
.setClockwork(() => {
  return setInterval(() => {
    timerCheck(Module.client);
  }, 60_000);
})
.setInit(async () => {
  // if the bot isn't restarted at all in 6 months then we probably have a bigger issue than some meme timer
  reminders = await u.db.reminder.fetchUpcoming(u.moment().add(MONTH_THRESHOLD, "months"));
  timerCheck(Module.client);
});

module.exports = Module;