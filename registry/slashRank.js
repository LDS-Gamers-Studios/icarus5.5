const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "rank",
  "description": "Interact with the XP system",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "view",
      "description": "View the rank of a user",
      "options": [
        {
          "name": "user",
          "description": "The user you want to get the rank of.",
          "type": type.User,
          "required": false
        }
      ]
    },
    {
      "name": "leaderboard",
      "description": "Shows the current leaderboard",
      "type": type.Subcommand
    },
    {
      "type": type.Subcommand,
      "name": "track",
      "description": "Whether or not you want to track XP.",
      "options": [
        {
          "type": type.Boolean,
          "name": "choice",
          "description": "Whether or not you want to track XP. ",
          "required": true
        }
      ]
    }
  ]
};
