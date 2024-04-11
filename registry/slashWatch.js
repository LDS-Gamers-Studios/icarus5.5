const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "watch",
  "description": "Watchlist for LDSG",
  "default_permission": false,
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "name": "user",
      "description": "Who do you want to put on the watchlist?",
      "type": type.User,
      "required": true,
    },
    {
      "name": "apply",
      "description": "Apply role (default: true)",
      "type": type.Boolean,
      "required": false,
    }
  ]
};