const { AugurClient } = require("augurbot-ts"),
  config = require("./config/config.json"),
  { AllowedMentionsTypes, Partials } = require("discord.js"),
  u = require("./utils/utils");

const client = new AugurClient(config, {
  clientOptions: {
    allowedMentions: {
      parsed: [AllowedMentionsTypes.Role, AllowedMentionsTypes.User],
      repliedUser: true
    },
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
  },
  commands: "./modules",
  errorHandler: u.errorHandler,
  parse: u.parse
});

client.login();

// LAST DITCH ERROR HANDLING
process.on("unhandledRejection", (error, p) => p.catch(e => u.errorHandler(e, "Unhandled Rejection")));
process.on("uncaughtException", (error) => u.errorHandler(error, "Uncaught Exception"));

module.exports = client;
