// @ts-check
const Discord = require('discord.js');
const config = require('../config/config.json');

module.exports = {
  privateCommand: config.devMode ? null : 0,
  cmd: Discord.SlashCommandBuilder,
  userContext: () => new Discord.ContextMenuCommandBuilder().setType(2),
  msgContext: () => new Discord.ContextMenuCommandBuilder().setType(3),
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
  role: Discord.SlashCommandRoleOption
};