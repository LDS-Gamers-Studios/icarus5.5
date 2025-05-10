const u = require("./regUtils");

const timer = new u.sub()
  .setName("timer")
  .setDescription("Set a countdown timer and get a DM after a delay.")
  .addStringOption(
    new u.string()
      .setName("timer-text")
      .setDescription("What are you using the timer for?")
  )
  .addIntegerOption(
    new u.int()
      .setName("days")
      .setDescription("How many days?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
      .setName("hours")
      .setDescription("How many hours?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
      .setName("minutes")
      .setDescription("How many minutes?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  );

const reminder = new u.sub()
  .setName("reminder")
  .setDescription("Get a DM reminder at a specific time.")
  .addStringOption(
    new u.string()
      .setName("reminder-text")
      .setDescription("What should I remind you about?")
      .setRequired(true)
      .setMaxLength(250)
  )
  .addStringOption(
    new u.string()
      .setName("month")
      .setDescription("What month to remind you in")
      .setChoices([
        { name: "January", value: "01" },
        { name: "February", value: "02" },
        { name: "March", value: "03" },
        { name: "April", value: "04" },
        { name: "May", value: "05" },
        { name: "June", value: "06" },
        { name: "July", value: "07" },
        { name: "August", value: "08" },
        { name: "September", value: "09" },
        { name: "October", value: "10" },
        { name: "November", value: "11" },
        { name: "December", value: "12" },
      ])
      .setRequired(true)
  )
  .addIntegerOption(
    new u.int()
      .setName("day")
      .setDescription("Which day of the month?")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(31)
  )
  .addIntegerOption(
    new u.int()
      .setName("year")
      .setDescription("Which year?")
      .setMinValue(new Date().getFullYear())
      .setMaxValue(new Date().getFullYear() + 100)
  )
  .addStringOption(
    new u.string()
      .setName("time")
      .setDescription("Timezone is MST. Format as 12:34 AM/PM or 14:00.")
      .setMaxLength(8)
      .setMinLength(3)
  );

const cancel = new u.sub()
  .setName("cancel")
  .setDescription("Cancel timers and reminders or get a list of upcoming ones.")
  .addStringOption(
    new u.string()
      .setName("id")
      .setDescription("Your timer or reminder ID. Leave blank to get a list of upcoming ones.")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .addSubcommand(timer)
  .addSubcommand(reminder)
  .addSubcommand(cancel)
  .setName("clockwork")
  .setDescription("Timers and such...");