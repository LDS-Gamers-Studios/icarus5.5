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
    interaction.reply(`📈 **Members:**\n${ldsg.memberCount} Members\n${online.size} Online`);
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
    new u.Button().setCustomId("suggestionManage").setEmoji("✏️").setLabel("Manage Ticket").setStyle(Discord.ButtonStyle.Primary),
  ])
];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashLdsgSuggest(int) {
  const suggestion = int.options.getString("suggestion", true);
  await int.deferReply({ ephemeral: true });
  const embed = u.embed({ author: int.user })
    .setTitle("Suggestion")
    .setDescription(suggestion)
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
    const replyModal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("replyText")
          .setLabel("Reply")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Your reply to the user")
      ])
    ).setCustomId("reply").setTitle("Suggestion Reply");
    const manageModal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("renameText")
          .setLabel("Rename")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("New title for the forum post"),
      ]),
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("issueText")
          .setLabel("Set Issue")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("New issue text")
      ]),
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("causeText")
          .setLabel("Set Cause")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("New root cause text")
      ])
    ).setCustomId("manageModal").setTitle("Manage Ticket");
    const channel = {
      suggestionPA: u.sf.forums.publicaffairs,
      suggestionLog: u.sf.forums.logistics,
      suggestionOps: u.sf.forums.operations,
      suggestionMgmt: u.sf.forums.management,
      suggestionIcarus: u.sf.forums.bottesting
    }[int.customId];
    if (channel) {
      await int.update({ embeds: [u.embed(suggestion.embeds[0]).setColor("#808080").addFields({ name: `Status`, value: `Sent to <#${channel}> by ${int.user}` })], components: [] });
      return int.client.getForumChannel(channel)?.threads.create({ name: `Suggestion from ${suggestion.embeds[0].author?.name}`, message: { content: suggestion.embeds[0].description ?? "", embeds: [embed], components: replyOption } });
    } else if (int.customId == "suggestionReply") {
      await int.showModal(replyModal);
      const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      const reply = submitted.fields.getTextInputValue("replyText");
      const em = u.embed({ author: int.user })
          .setTitle("Suggestion Feedback")
          .addFields({ name: "Reply:", value: reply });
      const member = int.guild.members.cache.get(suggestion.embeds[0].footer?.text ?? "");
      if (!member) return int.channel?.send("I could not find that member");
      try {
        member.send({ embeds: [em] });
        return int.channel?.send({ content: "Replied to user:", embeds: [em] });
      } catch (e) {
        u.errorHandler(e, int);
        return int.channel?.send("Failed to message member, they may have me blocked. You will need to reach out to them on your own this time!");
      }
    } else if (int.customId == "suggestionManage") {
      if (!int.channel) return int.reply({ content: "Channel error", ephemeral: true });
      const post = int.guild.channels.cache.get(int.channel.id);
      await int.showModal(manageModal);
      const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      const title = submitted.fields.getTextInputValue("renameText");
      const issue = submitted.fields.getTextInputValue("issueText");
      const cause = submitted.fields.getTextInputValue("causeText");
      if (!title && !issue && !cause) return int.followUp({ content: "I need some stuff to change!", ephemeral: true });
      const fields = int.message.embeds[0].fields;
      const em = u.embed(int.message.embeds[0]);
      if (title) {
        try {
          const old = post?.name;
          await post?.setName(title);
          int.followUp({ content: `> Changed title from "${old}" to "${title}"`, ephemeral: true });
        } catch (e) {
          u.errorHandler(e, int);
          return int.channel.send("Failed to rename forum post");
        }
      }
      if (issue) em.setFields([...fields.filter(f => f.name != "Issue"), { name: "Issue", value: issue }]);
      if (cause) em.setFields([...fields.filter(f => f.name != "Root Cause"), { name: "Root Cause", value: cause }]);
      return int.message.edit({ content: int.message.content, embeds: [em], components: replyOption });
    } else {
      return int.update({ embeds: [embed.setColor("#808080").addFields({ name: `Suggestion ignored`, value: `by ${int.user}` })], components: [] });
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

