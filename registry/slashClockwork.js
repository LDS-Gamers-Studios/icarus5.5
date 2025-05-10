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
      .setDescription("How many days until your timer goes off?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
      .setName("hours")
      .setDescription("How many hours until your timer goes off?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
      .setName("minutes")
      .setDescription("How many minutes until your timer goes off?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  );

const reminder = new u.sub()
  .setName("reminder")
  .setDescription("Get a reminder at a specific time")
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
        { name: "Jan", value: "01" },
        { name: "Feb", value: "02" },
        { name: "Mar", value: "03" },
        { name: "Apr", value: "04" },
        { name: "May", value: "05" },
        { name: "June", value: "06" },
        { name: "July", value: "07" },
        { name: "Aug", value: "08" },
        { name: "Sept", value: "09" },
        { name: "Oct", value: "10" },
        { name: "Nov", value: "11" },
        { name: "Dec", value: "12" },
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
  )
  .addStringOption(
    new u.string()
      .setName("time")
      .setDescription("12:34 AM/PM (Timezone is MST)")
      .setMaxLength(8)
      .setMinLength(3)
  );

const cancel = new u.sub()
  .setName("cancel")
  .setDescription("Cancel a pending timer or reminder")
  .addStringOption(
    new u.string()
      .setName("id")
      .setDescription("Your timer or reminder ID. Leave blank to get a list of pending ones.")
      .setRequired(false)
  );

module.exports = new u.cmd()
  .addSubcommand(timer)
  .addSubcommand(reminder)
  .addSubcommand(cancel)
  .setName("clockwork")
  .setDescription("Timers and such...");