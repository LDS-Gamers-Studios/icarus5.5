const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "bank",
  "description": "Interact with the server currencies.",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "give",
      "description": "Give someone a currency.",
      "options": [
        {
          "type": type.User,
          "name": "recipient",
          "description": "Who do you want to give currency to?",
          "required": true
        },
        {
          "type": type.String,
          "name": "currency",
          "description": "What do you want to give them?",
          "choices": [
            {
              "name": "Ghostbucks",
              "value": "gb"
            },
            {
              "name": "Ember",
              "value": "em"
            }
          ],
          "required": true
        },
        {
          "type": type.Integer,
          "name": "amount",
          "description": "How much do you want to send? (Max 1,000 GB or 10,000 Ember.)",
          "required": true
        },
        {
          "type": type.String,
          "name": "reason",
          "description": "But ... why?"
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "balance",
      "description": "View your current currency balance."
    },
    {
      "type": type.SubcommandGroup,
      "name": "game",
      "description": "Interact with the GhostBucks game store.",
      "options": [
        {
          "type": type.Subcommand,
          "name": "list",
          "description": "View the games that can be purchased with GhostBucks."
        },
        {
          "type": type.Subcommand,
          "name": "redeem",
          "description": "Purchase a game with GhostBucks.",
          "options": [
            {
              "type": type.String,
              "name": "code",
              "description": "What is the code you'd like to redeem?",
              "required": true
            }
          ]
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "discount",
      "description": "Use GhostBucks to create a discount code for the LDSG store. 1 GB = 1¢",
      "options": [
        {
          "type": type.Integer,
          "name": "amount",
          "description": "How many GB would you like to use? Limit 1,000 ($10).",
          "required": true
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "award",
      "description": "[TEAM] Award ember to a member for the house cup.",
      "options": [
        {
          "type": type.User,
          "name": "recipient",
          "description": "Who do you want to award?",
          "required": true
        },
        {
          "type": type.Integer,
          "name": "amount",
          "description": "How much ember do you want to give them?",
          "required": true
        },
        {
          "type": type.String,
          "name": "reason",
          "description": "But ... why?",
          "required": true
        }
      ]
    }
  ]
};