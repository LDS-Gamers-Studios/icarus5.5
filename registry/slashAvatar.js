const Discord = require('discord.js');
const type = Discord.ApplicationCommandOptionType;

module.exports = {
  "name": "avatar",
  "description": "See someone's avatar or apply a filter to it.",
  "type": Discord.ApplicationCommandType.ChatInput,
  "options": [
    {
      "type": type.User,
      "name": "user",
      "description": "The user whose avatar you want to see."
    },
    {
      "type": type.Attachment,
      "name": "file",
      "description": "Alternative to user. Requires a filter."
    },
    {
      "type": type.String,
      "name": "filter",
      "description": "The filter to apply.",
      "choices": [
        { "name": "Andy Warhol", "value": "andywarhol" },
        { "name": "Blur", "value": "blur" },
        { "name": "Blurple", "value": "blurple" },
        { "name": "Colorize", "value": "colorme" },
        { "name": "Deepfry", "value": "deepfry" },
        { "name": "Fisheye Lens", "value": "fisheye" },
        { "name": "Flex", "value": "flex" },
        { "name": "Flip Both", "value": "flipxy" },
        { "name": "Flip Horizontal", "value": "flipx" },
        { "name": "Flip Vertical", "value": "flipy" },
        { "name": "Grayscale", "value": "grayscale" },
        { "name": "Invert", "value": "invert" },
        { "name": "Metal", "value": "metal" },
        { "name": "Personal", "value": "personal" },
        { "name": "Petpet", "value": "petpet" },
        { "name": "Pop Art", "value": "popart" }
      ]
    }
  ]
}