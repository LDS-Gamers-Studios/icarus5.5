// @ts-check
const u = require("./regUtils");

/** Who do you want to X? */
const user = (action, req = true) => new u.user()
  .setName('user')
  .setDescription(`Who do you want to ${action}?`)
  .setRequired(req);

/** Why are they being X? */
const reason = (action, req = true) => new u.string()
  .setName("reason")
  .setDescription(`Why are they being ${action}?`)
  .setRequired(req);

/** Should I add (true) or remove (false) the X? (Default: Y) */
const apply = (obj, def = "add") => new u.bool()
  .setName("apply")
  .setDescription(`"Should I add (\`true\`) or remove (\`false\`) the ${obj}? (Default: \`(${def}\`)`)
  .setRequired(false);

const ban = new u.sub()
  .setName("ban")
  .setDescription("Ban a user")
  .addUserOption(user("ban"))
  .addStringOption(reason("banned"))
  .addIntegerOption(
    new u.int()
      .setName("clean")
      .setDescription("How many days of messages should I remove? (Default: 1)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(7)
  );

const filter = new u.sub()
  .setName("filter")
  .setDescription("Add or remove a word from the language filter")
  .addStringOption(
    new u.string()
      .setName("word")
      .setDescription("Which word do you want to modify?")
      .setRequired(true)
  )
  .addBooleanOption(apply('word', 'add'));

const grownups = new u.sub()
  .setName("grownups")
  .setDescription("The grownups are talking here, so I'll ignore the messages sent here for a bit.")
  .addIntegerOption(
    new u.int()
      .setName("time")
      .setDescription("How long do you want me to leave?")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(30)
  );

const summary = new u.sub()
  .setName("summary")
  .setDescription("Check user details and infractions")
  .addUserOption(user("get info on"))
  .addIntegerOption(
    new u.int()
      .setName("history")
      .setDescription("How many days history do you need? (Default: 28)")
      .setMinValue(1)
      .setRequired(false)
  );

const kick = new u.sub()
  .setName("kick")
  .setDescription("Kick a user")
  .addUserOption(user("kick"))
  .addStringOption(reason("kicked"));

const mute = new u.sub()
  .setName("mute")
  .setDescription("Mute or unmute a user")
  .addUserOption(user("mute"))
  .addStringOption(reason("muted", false))
  .addBooleanOption(apply("mute", "apply"));

const note = new u.sub()
  .setName("note")
  .setDescription("Make a note about a user")
  .addUserOption(user("write a note about"))
  .addStringOption(
    new u.string()
      .setName("note")
      .setDescription("What is the note?")
      .setRequired(true)
  );

const office = new u.sub()
  .setName("office")
  .setDescription("Send a user to the office")
  .addUserOption(user("send to the office"))
  .addStringOption(reason("sent there"))
  .addBooleanOption(apply("user from the office", "add"));

const purge = new u.sub()
  .setName("purge")
  .setDescription("Purge messages in the channel")
  .addIntegerOption(
    new u.int()
      .setName("number")
      .setDescription("How many messages should I delete?")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption(reason("purged"));

const rename = new u.sub()
  .setName("rename")
  .setDescription("Change a user's nickname")
  .addUserOption(user('rename'))
  .addStringOption(
    new u.string()
      .setName("name")
      .setDescription("What name should I apply? (Defaults to a random silly name)")
      .setRequired(false)
  )
  .addBooleanOption(
    new u.bool()
      .setName("reset")
      .setDescription("Resets their nickname to default")
      .setRequired(false)
  );

const watchlist = new u.sub()
  .setName("watchlist")
  .setDescription("Shows the trusted but watched members");

const slowmode = new u.sub()
  .setName("slowmode")
  .setDescription("Set a temporary slow mode in the current channel")
  .addIntegerOption(
    new u.int()
      .setName("duration")
      .setDescription("How many minutes will it last? (Default: `10`)")
      .setMinValue(0)
      .setRequired(false)
  )
  .addIntegerOption(
    new u.int()
      .setName("delay")
      .setDescription("How many seconds between messages? (Default: `15`)")
      .setMinValue(0)
      .setRequired(false)
  )
  .addBooleanOption(
    new u.bool()
      .setName("indefinite")
      .setDescription("Enables slowmode forever")
      .setRequired(false)
  );

const trust = new u.sub()
  .setName("trust")
  .setDescription("Trust, Trust+, or untrust a user")
  .addUserOption(user("apply this to"))
  .addStringOption(
    new u.string()
      .setName("type")
      .setDescription("What type of trusting is needed?")
      .setChoices(
        { name: "Initial", value: "initial" },
        { name: "Plus", value: "plus" }
      )
      .setRequired(true)
  )
  .addBooleanOption(apply("role", "add"));

const timeout = new u.sub()
  .setName("timeout")
  .setDescription("Prevent someone from chatting without muting them")
  .addUserOption(user("timeout"))
  .addIntegerOption(
    new u.int()
      .setName("time")
      .setDescription("How many minutes do you want to time them out for? (0 resets)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(30)
  )
  .addStringOption(reason("timed out", false));

const warn = new u.sub()
  .setName("warn")
  .setDescription("Give a user a warning")
  .addUserOption(user("warn"))
  .addStringOption(reason("warned"))
  .addIntegerOption(
    new u.int()
      .setName("value")
      .setDescription("What value is their warning? (Default: `1`)")
      .setRequired(false)
      .setMinValue(1)
  );

const watch = new u.sub()
  .setName("watch")
  .setDescription("Add or remove a user from the watchlist")
  .addUserOption(user("put on the watchlist"))
  .addBooleanOption(apply("user from the watchlist", "add"));

module.exports = new u.cmd()
  .setName("mod")
  .setDescription("Modding actions within LDSG")
  .addSubcommand(ban)
  .addSubcommand(filter)
  .addSubcommand(grownups)
  .addSubcommand(kick)
  .addSubcommand(mute)
  .addSubcommand(note)
  .addSubcommand(office)
  .addSubcommand(purge)
  .addSubcommand(rename)
  .addSubcommand(watchlist)
  .addSubcommand(slowmode)
  .addSubcommand(summary)
  .addSubcommand(trust)
  .addSubcommand(timeout)
  .addSubcommand(warn)
  .addSubcommand(watch)
  .setDMPermission(false)
  .setDefaultMemberPermissions(0)
  .toJSON();
