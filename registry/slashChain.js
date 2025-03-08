// @ts-check
const u = require('./regUtils');

const rollF = new u.sub()
  .setName("rollf")
  .setDescription("Roll Fate Dice")
  .addIntegerOption(
    new u.int()
    .setName("dice")
    .setDescription("How many dice to roll? (will roll at least 1 anyway) (max of 10000)")
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(10000)
  )
  .addIntegerOption(
    new u.int()
    .setName("modifier")
    .setDescription("How much to change the roll by? (defaults to 0)")
    .setRequired(false)
  );
const rollOld = new u.sub()
  .setName("rollop")
  .setDescription("Roll Dice using the old formula format")
  .addStringOption(
    new u.string()
    .setName("rollformula")
    .setDescription("old dice formula to use, it errors in the same way as !roll did")
  );

const allthe = new u.sub()
  .setName("allthe")
  .setDescription("ALL THE _____!")
  .addStringOption(
    new u.string()
    .setName("thing")
    .setDescription("something")
    .setRequired(true)
  );

const hug = new u.sub()
.setName("hug")
.setDescription("Send a much needed hug.")
.addUserOption(
  new u.user()
  .setName("hugee")
  .setDescription("Who do you want to hug?")
  .setRequired(true)
);

module.exports = new u.cmd()
  .setName("chain")
  .setDescription("Commands normal icarus doesn't have.")
  .addSubcommand(rollF)
  .addSubcommand(rollOld)
  .addSubcommand(allthe)
  .addSubcommand(hug)
  .toJSON();