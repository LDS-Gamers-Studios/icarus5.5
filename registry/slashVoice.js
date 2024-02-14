const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "voice",
  "description": "Voice options.",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "lock",
      "description": "Lock your voice channel to new members.",
      "options": [
        {
          "type": type.String,
          "name": "users",
          "description": "Mentions of users you would like to allow in the channel."
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "unlock",
      "description": "Unlock your voice channel to new members."
    },
    {
      "type": type.Subcommand,
      "name": "streamlock",
      "description": "Restrict voice for new members of your channel.",
      "options": [
        {
          "type": type.String,
          "name": "users",
          "description": "Mentions of users you want to allow to speak/stream in the channel."
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "refresh",
      "description": "Check that there are voice channels to join, and create a channel if not."
    }
  ]
};