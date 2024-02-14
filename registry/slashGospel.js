const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "gospel",
  "description": "Search gospel topics.",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.Subcommand,
      "name": "verse",
      "description": "Gets book headings, chapter headings, or verses.",
      "options": [
        {
          "type": type.String,
          "name": "book",
          "description": "The name of the book. `1 Nephi` , `Mosiah` , etc."
        },
        {
          "type": type.Integer,
          "name": "chapter",
          "description": "The chapter in the book."
        },
        {
          "type": type.String,
          "name": "verses",
          "description": "Formats: `3`, `3-5`, `3-6,8,10-14`, etc. using commas, dashes, and numbers."
        }
      ]
    },
    {
      "type": type.Subcommand,
      "name": "comefollowme",
      "description": "Get the current Come Follow Me lesson."
    },
    {
      "type": type.Subcommand,
      "name": "news",
      "description": "Gets LDS news.",
      "options": [
        {
          "type": type.String,
          "name": "source",
          "description": "The news source.",
          "choices": [
            {
              "name": "Newsroom",
              "value": "newsroom"
            },
            {
              "name": "Tabernacle Choir",
              "value": "choir"
            }
          ],
          "required": true
        }
      ]
    }
  ]
};