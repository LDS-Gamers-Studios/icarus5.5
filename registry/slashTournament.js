
const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "tournament",
  "description": "Get or update information on tournaments in the server",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "list",
      "description": "Find upcoming LDSG tournaments."
    },
    {
      "type": type.Subcommand,
      "name": "champion",
      "description": "[TEAM] Declare an LDSG Champion!",
      "options": [
        {
          "type": type.String,
          "name": "tourney-name",
          "description": "The name of the tournament",
          "required": true
        },
        {
          "type": type.User,
          "name": "1",
          "description": "User 1",
          "required": true
        },
        {
          "type": type.User,
          "name": "2",
          "description": "User 2"
        },
        {
          "type": type.User,
          "name": "3",
          "description": "User 3"
        },
        {
          "type": type.User,
          "name": "4",
          "description": "User 4"
        },
        {
          "type": type.User,
          "name": "5",
          "description": "User 5"
        },
        {
          "type": type.User,
          "name": "6",
          "description": "User 6"
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "participant",
      "description": "[TEAM] Add or remove someone from the Tournament Access role",
      "options": [
        {
          "type": type.User,
          "name": "user",
          "description": "The user to add or remove",
          "required": true
        },
        {
          "type": type.Boolean,
          "name": "remove",
          "description": "Whether or not to remove the role (defaults to false)"
        },
        {
          "type": type.Boolean,
          "name": "remove-all",
          "description": "[DANGER] Removes the tournament role from all users"
        }
      ]
    }
  ]
}