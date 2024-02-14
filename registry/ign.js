const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "ign",
  "description": "Save and view various game system IGNs or social network names",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "set",
      "description": "Sets your various game system IGNs or social network names",
      "options": [
        {
          "type": type.String,
          "name": "system",
          "description": "The game, system, or social network for which you wish to set an IGN",
          "required": true
        },
        {
          "type": type.String,
          "name": "ign",
          "description": "The IGN for that system",
          "required": true
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "view",
      "description": "Shows IGN information for someone",
      "options": [
        {
          "type": type.String,
          "name": "system",
          "description": "The system to get information about. If blank, all saved IGNs will be listed"
        },
        {
          "type": type.User,
          "name": "target",
          "description": "The person to view (default: you)"
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "whoplays",
      "description": "Find everyone in the server who has added a given IGN system",
      "options": [
        {
          "type": type.String,
          "name": "system",
          "description": "The system you would like to list",
          "required": true
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "remove",
      "description": "Remove an IGN",
      "options": [
        {
          "type": type.String,
          "name": "system",
          "description": "The system you wish to remove from your profile",
          "required": true
        }
      ]
    }
  ]
};
