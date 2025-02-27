// @ts-check

const Augur = require("augurbot-ts"),
  u = require('../utils/utils'),
  avatars = require("../utils/avatarHandler");
const { Webhook } = require("discord.js");

// eslint-disable-next-line no-unused-vars
async function sendAsv1(avatarURL, nick, content, channel) {
//  console.log("steph")
//  console.log(steph)
//  console.log("steph.user")
//  console.log(steph.user)
  const client = this.client;
  const bot = this.client.user;
  //  console.log("bot")
  //  console.log(bot)
  const guildView = await client.guilds.fetch(channel.guild.id);
  // console.log("guildView");
  // console.log(guildView);
  const botFromGuildView = await guildView.members.fetch(bot.id);
  // console.log("botFromGuildView");
  // console.log(botFromGuildView);
  const oldPFP = bot.avatarURL();
  const oldNick = botFromGuildView.nickname;
  // console.log("pfp:" + oldPFP);
  // console.log("nick:" + oldNick);
  bot.setAvatar(avatarURL);
  botFromGuildView.setNickname(nick);
  // console.log("pfp:" + bot.avatarURL());
  // console.log("nick:" + botFromGuildView.nickname);
  const ret = await channel.send(content);
  bot.avatarURL(oldPFP);
  botFromGuildView.setNickname(oldNick);
  // console.log("pfp:" + bot.avatarURL());
  // console.log("nick:" + botFromGuildView.nickname);
  return ret;
}
/**
 * @typedef ParsedInteraction
 * @property {String | null} command - The command issued, represented as a string.
 * @property {{name: string, value: string|number|boolean|undefined}[]} data - Associated data for the command, such as command options or values selected.
 */

/**
 * Sends a text message with a specific avatarurl and display name
 */
async function sendAs(avatarURL, nick, content, channel) {
  //  console.log("channel")
  //  console.log(channel)
  const webhooks = await channel.fetchWebhooks();
  //  console.log("webhooks")
  //  console.log(webhooks)
  /**
   * @type {Webhook}
   */
  const webhook = webhooks.find(awebhook => awebhook.name === "automadeSlashSendHook") ?? (await channel.createWebhook({ name: nick, avatar: avatarURL }));
  await webhook.edit({ name: nick, avatar: avatarURL });
  await webhook.send(content);
  await webhook.edit({ name: "automadeSlashSendHook" });
}

const Module = new Augur.Module()
  .addInteraction({
    name: "send",
    id: u.sf.commands.slashSend,
    // @ts-ignore
    permissions: (int) => u.sf.canSend.includes(int.member.id) || u.perms.isOwner(int.member),
    process: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.options.getString('category', true);
      if (category === "Normal") {
        if (!interaction.channel) {
          return await interaction.editReply("I can't tell where here is...");
        }
        // @ts-ignore
        await interaction.channel.send(
          interaction.options.getString('content', true)
        ).catch(u.noop);
      } else if (category === "Manual") {
        await sendAs(
          interaction.options.getString('pfp', true),
          interaction.options.getString('nick', true),
          interaction.options.getString('content', true),
          interaction.channel);
      } else {
        if (!avatars.sendAvatars[category]) {
          return await interaction.editReply("I could not find the premade persona category: \"" + category + "\"");
        }
        const avatarId = interaction.options.getString(category);
        if (!avatarId) {
          return await interaction.editReply("You did not specify a persona within the \"" + category + "\" category.");
        }
        await sendAs(
          avatars.sendAvatars[category][avatarId].pfp,
          avatars.sendAvatars[category][avatarId].nick,
          interaction.options.getString('content', true),
          interaction.channel);
      }
      return interaction.editReply("Sent.");
    }
  });

module.exports = Module;