// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js");

/**
 * Responds with the number of guild members, and how many are online.
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 */
async function slashLdsgMembers(interaction) {
  try {
    const ldsg = interaction.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("Couldn't find LDSG");
    const online = ldsg.members.cache.filter((member) => member?.presence && member.presence.status != "offline");
    const response = `📈 **Members:**\n${ldsg.memberCount} Members\n${online.size} Online`;
    await interaction.reply(response );
  } catch (error) { u.errorHandler(error, interaction); }
}

const sendOptions = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("suggestionPA").setEmoji("🗣️").setLabel("Public Affairs").setStyle(Discord.ButtonStyle.Success),
    new u.Button().setCustomId("suggestionLog").setEmoji("🚚").setLabel("Logistics").setStyle(Discord.ButtonStyle.Success),
    new u.Button().setCustomId("suggestionOps").setEmoji("🗓️").setLabel("Operations").setStyle(Discord.ButtonStyle.Success),
    new u.Button().setCustomId("suggestionMgmt").setEmoji("⚙️").setLabel("Management").setStyle(Discord.ButtonStyle.Primary),
    new u.Button().setCustomId("suggestionIcarus").setEmoji("🤖").setLabel("Icarus").setStyle(Discord.ButtonStyle.Primary),
  ]),
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("suggestionIgnore").setEmoji("⚠️").setLabel("Ignore").setStyle(Discord.ButtonStyle.Danger),
  ])
];

const replyOption = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("suggestionReply").setEmoji("🗨️").setLabel("Reply to user").setStyle(Discord.ButtonStyle.Primary),
    new u.Button().setCustomId("suggestionRename").setEmoji("✏️").setLabel("Edit title").setStyle(Discord.ButtonStyle.Primary)
  ])
];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashLdsgSuggest(int) {
  const suggestion = int.options.getString("suggestion", true);
  await int.deferReply({ ephemeral: true });
  const embed = u.embed({ author: int.user })
    .addFields({ name: "Suggestion:", value: suggestion })
    .setFooter({ text: int.user.id });
  await int.client.getTextChannel(u.sf.channels.suggestionBox)?.send({ embeds: [embed], components: sendOptions });
  int.editReply("Sent!");
  return int.user.send({ content: "You have sent the following suggestion to the LDSG Team for review:", embeds: [embed] });
}

/** @param {Discord.ButtonInteraction<"cached">} int */
async function processCardAction(int) {
  try {
    const suggestion = int.message;
    const embed = u.embed(suggestion.embeds[0]);
    const modal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("text")
          .setLabel("Reply")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Your reply to the user")
      ])
    ).setCustomId("reply").setTitle("Suggestion Reply");
    const edit = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("txt")
          .setLabel("Rename")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("New title for the forum post") 
      ])
    ).setCustomId("rename").setTitle("Rename");
    let submitted;
    let em;
    let reply;
    let member;
    const channel = {
      suggestionPA: u.sf.channels.publicaffairsForum,
      suggestionLog: u.sf.channels.logisticsForum,
      suggestionOps: u.sf.channels.operationsForum,
      suggestionMgmt: u.sf.channels.managementForum,
      suggestionIcarus: u.sf.channels.bottestingForum
    }[int.customId];
    if (channel) {
      embed.addFields({ name: `Status`, value: `Sent to <#${channel}> by ${int.user}` });
      int.client.getForumChannel(channel)?.threads.create({ name: `Suggestion from ${suggestion.embeds[0].author?.name}`, message: { embeds: [suggestion.embeds[0]], components: replyOption } });
      return int.update({ embeds: [embed], components: [] });
    } else if (int.customId == "suggestionReply") {
      await int.showModal(modal);
      submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      reply = submitted.fields.getTextInputValue("text");
      em = u.embed({ author: int.user })
          .setTitle("Suggestion feedback")
          .addFields({ name: "Reply:", value: reply });
      member = int.guild.members.cache.get(suggestion.embeds[0].footer?.text ?? "");
      if (!member) return int.channel?.send("I could not find that member");
      try {
        member.send({ embeds: [em] });
        return int.channel?.send({ content: "Replied to user:", embeds: [em] });
      } catch (e) {
        u.errorHandler(e, int);
        return int.channel?.send("Failed to message member, they may have me blocked. You will need to reach out to them on your own this time!");
      }
    } else if (int.customId == "suggestionRename") {
      if(!int.channel) return int.reply("Channel error");
      const post = int.guild.channels.cache.get(int.channel.id);
      await int.showModal(edit);
      submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      const name = submitted.fields.getTextInputValue("txt");
      const old = post?.name;
      try {
        await post?.setName(name);
        int.channel.send(`Changed title from "${old}" to "${name}"`);
      } catch (e) {
        u.errorHandler(e, int);
        return int.channel.send("Failed to rename forum post")
      }
    } else {
      embed.addFields({ name: `Suggestion ignored`, value: `by ${int.user}` });
      return int.update({ embeds: [embed], components: [] });
    }
  } catch (e) { u.noop; }
}

const Module = new Augur.Module()
  .addInteraction({
    name: "ldsg",
    id: u.sf.commands.slashLdsg,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
        case "members": return slashLdsgMembers(interaction);
        case "suggest": return slashLdsgSuggest(interaction);
      }
    }
  })
  .addEvent("interactionCreate", (int) => {
    if (!int.inCachedGuild() || !int.isButton() || int.guild.id != u.sf.ldsg) return;
    if (!u.perms.calc(int.member, ["team", "mgr"])) {
      return int.reply({ content: "You don't have permissions to interact with this suggestion!", ephemeral: true });
    }
    if (int.customId.startsWith("suggestion")) return processCardAction(int);
  });

module.exports = Module;

