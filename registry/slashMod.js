const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "mod",
  "description": "Modding Actions Within LDSG",
  "default_permission": false,
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "name": "ban",
      "description": "Ban a user",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who do you want to ban?",
          "type": type.User,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why are they being banned?",
          "type": type.String,
          "required": true
        },
        {
          "name": "clean",
          "description": "How many days of messages should I remove? (Default: 1)",
          "type": type.Integer,
          "required": false
        }
      ]
    },
    {
      "name": "filter",
      "description": "Add or remove a word from the language filter",
      "type": type.Subcommand,
      "options": [
        {
          "name": "word",
          "description": "Which word do you want to add to the language filter?",
          "type": type.String,
          "required": true
        },
        {
          "name": "apply",
          "description": "Should I add (`true`) or remove (`false`) the word? (Default: `true`)",
          "type": type.Boolean,
          "required": false
        }
      ]
    },
    {
      "name": "fullinfo",
      "description": "Check when a user joined the server and rank information",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Which user do you want info about?",
          "type": type.User,
          "required": false
        },
        {
          "name": "history",
          "description": "How many days history do you need? (Default `28`)",
          "type": type.Integer,
          "required": false
        }
      ]
    },
    {
      "name": "kick",
      "description": "Kick a user",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who do you want to kick?",
          "type": type.User,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why are they being kicked?",
          "type": type.String,
          "required": true
        }
      ]
    },
    {
      "name": "mute",
      "description": "Mute or unmute a user",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who do you want to mute?",
          "type": type.User,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why are they being muted?",
          "type": type.String,
          "required": false
        },
        {
          "name": "apply",
          "description": "Do I apply (`true`) or remove (`false`) the mute? (Default: `true`)",
          "type": type.Boolean,
          "required": false
        }
      ]
    },
    {
      "name": "note",
      "description": "Make a note about a user",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who needs the note?",
          "type": type.User,
          "required": true
        },
        {
          "name": "note",
          "description": "What is the note?",
          "type": type.String,
          "required": true
        }
      ]
    },
    {
      "name": "office",
      "description": "Send a user to the office",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who are you sending to the office?",
          "type": type.User,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why are you sending them there?",
          "type": type.String,
          "required": true
        },
        {
          "name": "apply",
          "description": "Am I sending them (`true`) or letting them out (`false`)? (Default: `true`)",
          "type": type.Boolean,
          "required": false
        }
      ]
    },
    {
      "name": "purge",
      "description": "Purge messages in the channel",
      "type": type.Subcommand,
      "options": [
        {
          "name": "number",
          "description": "How many messages should I delete?",
          "type": type.Integer,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why are you purging?",
          "type": type.String,
          "required": true
        }
      ]
    },
    {
      "name": "rename",
      "description": "Change a user's nickname, if their name is inappropriate",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Who do you want to rename?",
          "type": type.User,
          "required": true
        },
        {
          "name": "name",
          "description": "What name should I apply?",
          "type": type.String,
          "required": false
        }
      ]
    },
    {
      "name": "watchlist",
      "description": "Shows the trusted but watched members",
      "type": type.Subcommand,
      "options": []
    },
    {
      "name": "slowmode",
      "description": "Set a temporary slow mode on the channel",
      "type": type.Subcommand,
      "options": [
        {
          "name": "channel",
          "description": "Which channel needs a slowmode?",
          "type": type.Channel,
          "required": false
        },
        {
          "name": "duration",
          "description": "How many minutes will it last? (Default: `10`)",
          "type": type.Integer,
          "required": false
        },
        {
          "name": "timer",
          "description": "How many seconds between messages? (Default: `15`)",
          "type": type.Integer,
          "required": false
        },
        {
          "name": "indefinitely",
          "description": "Enable slowmode indefinitely",
          "type": type.Boolean,
          "required": false
        }
      ]
    },
    {
      "name": "summary",
      "description": "Get a brief summary of a user's history",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Whose summary do you want to see?",
          "type": type.User,
          "required": true
        },
        {
          "name": "history",
          "description": "How many days history do you need? (Default `28`)",
          "type": type.Integer,
          "required": false
        }
      ]
    },
    {
      "name": "trust",
      "description": "Trust or untrust a user",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Which user are you applying this to?",
          "type": type.User,
          "required": true
        },
        {
          "name": "type",
          "description": "What type of Trusting is needed?",
          "type": type.String,
          "choices": [
            { "name": "Initial", "value": "initial" },
            { "name": "Plus", "value": "plus" },
            { "name": "Watch", "value": "watch" }
          ],
          "required": true
        },
        {
          "name": "apply",
          "description": "Should I apply (`true`) or remove (`false`) the role? (Default: `true`)",
          "type": type.Boolean,
          "required": false
        }
      ]
    },
    {
      "name": "warn",
      "description": "Give a user a warning",
      "type": type.Subcommand,
      "options": [
        {
          "name": "user",
          "description": "Which user do you want to warn?",
          "type": type.User,
          "required": true
        },
        {
          "name": "reason",
          "description": "Why do you need to warn them?",
          "type": type.String,
          "required": true
        },
        {
          "name": "value",
          "description": "What value is the warning? (Default: `1`)",
          "type": type.Integer,
          "required": false
        }
      ]
    },
    {
      "name": "watch",
      "description": "Watchlist for LDSG",
      "default_permission": false,
      "type": type.Subcommand,
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
    }
  ]
};