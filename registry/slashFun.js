// @ts-check
const u = require('./regUtils');

const roll = new u.sub()
  .setName("roll")
  .setDescription("Roll Dice")
  .addIntegerOption(
    new u.int()
    .setName("dice")
    .setDescription("How many dice to roll? (Default: 1)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(10000)
  )
  .addIntegerOption(
    new u.int()
    .setName("sides")
    .setDescription("How many sides on the dice? (Default: 6)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(100000)
  )
  .addIntegerOption(
    new u.int()
    .setName("modifier")
    .setDescription("How much to change the roll by. (Default: 0)")
    .setRequired(false)
  );
const ball8 = new u.sub()
  .setName("8ball")
  .setDescription("Get an answer from the Magic 8-ball.")
  .addStringOption(
    new u.string()
    .setName("question")
    .setDescription("What do you wish to ask the 8-ball today?")
    .setRequired(true)
  );
const choose = new u.sub()
  .setName("choose")
  .setDescription("Helps make a choice!")
  .addStringOption(
    new u.string()
    .setName("options")
    .setDescription('options to choose from separated by "|"')
    .setRequired(true)
  );
const emoji = new u.sub()
  .setName("emoji")
  .setDescription("combines two (non-custom) emoji")
  .addStringOption(
    new u.string()
    .setName("emoji1")
    .setDescription("first emoji to combine")
    .setRequired(true)
  )
  .addStringOption(
    new u.string()
    .setName("emoji2")
    .setDescription("second emoji to combine")
    .setRequired(true)
  );
const repost = new u.sub()
.setName("repost")
.setDescription("That's a repost.");
const acronym = new u.sub()
.setName("acronym")
.setDescription("Get a random acronym. For science.")
.addIntegerOption(
  new u.int()
  .setName("length")
  .setDescription("How long of an acronym?")
  .setRequired(false)
  .setMinValue(1)
  .setMaxValue(10)
);
const mines = new u.sub()
  .setName("mines")
  .setDescription("Play a game of Minesweeper!")
  .addStringOption(
    new u.string()
    .setName("difficulty")
    .setDescription("5 by 5 with 5 mines, 10 by 10 with 30 mines, or 14 by 14 with 60 mines")
    .setRequired(true)
    .setChoices(
      { name: "Easy", value: "Easy" },
      { name: "Medium", value: "Medium" },
      { name: "Hard", value: "Hard" })
  );
const hbs = new u.sub()
  .setName("hbs")
  .setDescription("Play a game of Handicorn, Buttermelon, Sloth!")
  .addStringOption(
    new u.string()
    .setName("choice")
    .setDescription("Your choice of Handicorn, Buttermelon, or Sloth!")
    .setRequired(true)
    .setChoices(
      { name: "Handicorn", value: "Handicorn" },
      { name: "Buttermelon", value: "Buttermelon" },
      { name: "Sloth", value: "Sloth" })
  )
  .addStringOption(
    new u.string()
    .setName("mode")
    .setDescription("Who do you want to play against?")
    // .setRequired(false)
    .setChoices(
      { name: "Icarus", value: "icarus" },
      { name: "Other Users", value: "user" })
  );

const color = new u.sub()
  .setName("color")
  .setDescription("Show what a color looks like.")
  .addStringOption(
    new u.string()
    .setName("color")
    .setDescription("color (e.g. `#003B6F` or `blue`)")
  );
const nameGame = new u.sub()
  .setName("namegame")
  .setDescription("Sing the Name Game!")
  .addStringOption(
    new u.string()
    .setName("name")
    .setDescription("The name to play with (Default: your username)")
  );
const quote = new u.sub()
  .setName("quote")
  .setDescription("Get a random quote!");
const buttermelon = new u.sub()
  .setName("buttermelon")
  .setDescription("Get a random buttermelon fact");
module.exports = new u.cmd()
  .setName("fun")
  .setDescription("Its all fun and games till someone gets banned.")
  .addSubcommand(roll)
  .addSubcommand(ball8)
  .addSubcommand(repost)
  .addSubcommand(mines)
  .addSubcommand(acronym)
  .addSubcommand(hbs)
  .addSubcommand(color)
  .addSubcommand(buttermelon)
  .addSubcommand(quote)
  .addSubcommand(nameGame)
  .addSubcommand(choose)
  .addSubcommand(emoji)
  .toJSON();