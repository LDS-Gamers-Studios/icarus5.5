// @ts-check
const Discord = require('discord.js');
const config = require('../config/config.json');

module.exports = {
  privateCommand: config.devMode ? null : 0,
  cmd: Discord.SlashCommandBuilder,
  userContext: () => new Discord.ContextMenuCommandBuilder().setType(2),
  msgContext: () => new Discord.ContextMenuCommandBuilder().setType(3),
  contexts: Discord.InteractionContextType,
  sub: Discord.SlashCommandSubcommandBuilder,
  user: Discord.SlashCommandUserOption,
  bool: Discord.SlashCommandBooleanOption,
  int: Discord.SlashCommandIntegerOption,
  string: Discord.SlashCommandStringOption,
  subGroup: Discord.SlashCommandSubcommandGroupBuilder,
  attachment: Discord.SlashCommandAttachmentOption,
  channel: Discord.SlashCommandChannelOption,
  mentionable: Discord.SlashCommandMentionableOption,
  number: Discord.SlashCommandNumberOption,
  role: Discord.SlashCommandRoleOption,
  months: [
    { name: "January", value: "Jan" },
    { name: "February", value: "Feb" },
    { name: "March", value: "Mar" },
    { name: "April", value: "Apr" },
    { name: "May", value: "May" },
    { name: "June", value: "Jun" },
    { name: "July", value: "Jul" },
    { name: "August", value: "Aug" },
    { name: "September", value: "Sept" },
    { name: "October", value: "Oct" },
    { name: "November", value: "Nov" },
    { name: "December", value: "Dec" },
  ]
};