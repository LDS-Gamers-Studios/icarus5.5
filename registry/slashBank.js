// @ts-check
const u = require('./regUtils');

const give = new u.sub()
  .setName("give")
  .setDescription("Give someone a currency")
  .addUserOption(
    new u.user()
      .setName("user")
      .setDescription("Who do you want to give currency to?")
      .setRequired(true)
  )
  .addStringOption(
    new u.string()
      .setName("currency")
      .setDescription("What do you want to give them?")
      .setChoices(
        { name: "GhostBucks", value: "gb" },
        { name: "Ember", value: "em" }
      )
      .setRequired(true)
  )
  .addIntegerOption(
    new u.int()
      .setName("amount")
      .setDescription("How much do you want to give them? (Max 1,000 GB or 10,000 Ember.)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(10000)
  )
  .addStringOption(
    new u.string()
      .setName("reason")
      .setDescription("But... why?")
      .setRequired(false)
  );

const balance = new u.sub()
  .setName("balance")
  .setDescription("View your current currency balance");

const gameList = new u.sub()
  .setName("list")
  .setDescription("View the games that can be purchased with GhostBucks");

const gameRedeem = new u.sub()
  .setName("redeem")
  .setDescription("Purchase a game with GhostBucks")
  .addStringOption(
    new u.string()
      .setName("code")
      .setDescription("What is the code you'd like to redeem?")
      .setRequired(true)
  );

const game = new u.subGroup()
  .setName("game")
  .setDescription("Interact with the GhostBucks game store.")
  .addSubcommand(gameList)
  .addSubcommand(gameRedeem);

const discount = new u.sub()
  .setName("discount")
  .setDescription("Use GhostBucks to create a discount code for the LDSG store. 100GB = $1.00 USD")
  .addIntegerOption(
    new u.int()
      .setName("amount")
      .setDescription("How many GB would you like to use? Limit 1,000GB ($10 USD)")
      .setMinValue(1)
      .setMaxValue(1000)
      .setRequired(true)
  );

const redeemEmber = new u.sub()
  .setName("redeem-ember")
  .setDescription("Buy something with ember")
  .addStringOption(
    new u.string()
      .setName("item")
      .setDescription("The item to buy.")
      .setChoices([
        { name: "Rent-A-Channel Thread (700 EM)", value: "rac" }
      ])
      .setRequired(true)
  );

module.exports = new u.cmd()
  .setName("bank")
  .setDescription("Interact with the server currencies.")
  .setContexts(u.contexts.Guild)
  .addSubcommand(give)
  .addSubcommand(balance)
  .addSubcommandGroup(game)
  .addSubcommand(redeemEmber)
  // .addSubcommand(discount) no store rn
  // .addSubcommand(award) this is located at /team bank award in team.js
  .toJSON();

discount;