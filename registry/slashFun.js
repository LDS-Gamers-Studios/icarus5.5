// @ts-check
const u = require('./regUtils');

const roll = new u.sub()
  .setName("roll")
  .setDescription("Roll Dice")
  .addIntegerOption(
    new u.int()
    .setName("dice")
    .setDescription("How many dice to roll? (will roll at least 1 anyway) (max of 100)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
    .setName("sides")
    .setDescription("How many sides on the dice to roll? (defaults to 6)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(2147483647)
  )
  .addIntegerOption(
    new u.int()
    .setName("modifier")
    .setDescription("How much to change the roll by? (defaults to 0)")
    .setRequired(false)
  );
  const rollF = new u.sub()
  .setName("rollF")
  .setDescription("Roll Fate Dice")
  .addIntegerOption(
    new u.int()
    .setName("dice")
    .setDescription("How many dice to roll? (will roll at least 1 anyway) (max of 100)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(100)
  )
  .addIntegerOption(
    new u.int()
    .setName("modifier")
    .setDescription("How much to change the roll by? (defaults to 0)")
    .setRequired(false)
  );
  const rollOld = new u.sub()
  .setName("rollOld")
  .setDescription("Roll Dice using the old formula format")
  .addStringOption(
    new u.string()
    .setName("rollFormula")
    .setDescription("old dice formula to use, it errors in the same way as !roll did")
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
const repost = new u.sub()
.setName("repost")
.setDescription("That's a repost.");


module.exports = new u.cmd()
  .setName("fun")
  .setDescription("Its all fun and games till someone gets banned.")
  .addSubCommand(roll)
  .addSubCommand(rollF)
  .addSubCommand(rollOld)
  .addSubCommand(ball8)
  .addSubCommand(repost)
  .toJSON();
