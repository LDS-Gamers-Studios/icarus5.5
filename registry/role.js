const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

/** @type {Discord.ApplicationCommandData} */
module.exports = {
  "name": "role",
  "description": "Add and remove self-assignable roles",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "name": "add",
      "description": "Add an opt-in role",
      "type": type.Subcommand,
      "options": [
        {
          "name": "role",
          "description": "The role to add",
          "type": type.Role,
          "required": true
        }
      ]
    },
    {
      "name": "assign",
      "description": "[MOD ONLY] Assign someone a role",
      "type": type.Subcommand,
      "options": [
        {
          "name": "target",
          "description": "The user to receive the role",
          "type": type.User,
          "required": true
        },
        {
          "name": "role",
          "description": "The role to assign",
          "type": type.Role,
          "required": true
        }
      ]
    },
    {
      "name": "remove",
      "description": "Remove an opt-in role",
      "type": type.Subcommand,
      "options": [
        {
          "name": "role",
          "description": "The role to remove",
          "type": type.Role,
          "required": true,
        }
      ]
    },
    {
      "name": "inventory",
      "description": "View all equippable roles and equip a color from your inventory",
      "type": type.Subcommand
    }
  ]
};
