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
    await interaction.reply(`📈 **Members:**\n${ldsg.memberCount} Members\n${online.size} Online`);
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
    new u.Button().setCustomId("suggestionRename").setEmoji("✏️").setLabel("Set title").setStyle(Discord.ButtonStyle.Primary),
    new u.Button().setCustomId("suggestionIssue").setEmoji("✏️").setLabel("Set Issue").setStyle(Discord.ButtonStyle.Primary),
    new u.Button().setCustomId("suggestionCause").setEmoji("✏️").setLabel("Set Root Cause").setStyle(Discord.ButtonStyle.Primary)
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
    const titleModal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("renameText")
          .setLabel("Rename")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("New title for the forum post")
      ])
    ).setCustomId("setName").setTitle("Rename");
    const issueModal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("issueText")
          .setLabel("Set Issue")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("New issue text")
      ])
    ).setCustomId("setIssue").setTitle("Set Issue");
    const causeModal = new u.Modal().addComponents(
      u.ModalActionRow().addComponents([
        new u.TextInput()
          .setCustomId("causeText")
          .setLabel("Set Cause")
          .setStyle(Discord.TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("New root cause text")
      ])
    ).setCustomId("setCause").setTitle("Set Cause");
    const channel = {
      suggestionPA: u.sf.forums.publicaffairsForum,
      suggestionLog: u.sf.forums.logisticsForum,
      suggestionOps: u.sf.forums.operationsForum,
      suggestionMgmt: u.sf.forums.managementForum,
      suggestionIcarus: u.sf.forums.bottestingForum
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
    } else if (int.customId == "suggestionRename") {
      if (!int.channel) return int.reply({ content: "Channel error", ephemeral: true });
      const post = int.guild.channels.cache.get(int.channel.id);
      await int.showModal(titleModal);
      const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      const name = submitted.fields.getTextInputValue("renameText");
      const old = post?.name;
      try {
        await post?.setName(name);
        int.channel.send(`> Changed title from "${old}" to "${name}"`);
      } catch (e) {
        u.errorHandler(e, int);
        return int.channel.send("Failed to rename forum post");
      }
    } else if (["suggestionIssue", "suggestionCause"].includes(int.customId)) {
      const is = int.customId == "suggestionIssue";
      is ? await int.showModal(issueModal) : await int.showModal(causeModal);
      const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) return int.channel?.send("I fell asleep waiting for your input...");
      await submitted.deferUpdate();
      const input = is ? submitted.fields.getTextInputValue("issueText") : submitted.fields.getTextInputValue("causeText");
      const em = int.message.embeds[0];
      const field = is ? em.fields.find((element) => element.name == "Issue") : em.fields.find((element) => element.name == "Root Cause");
      if (field) {
        const past = field.value;
        field.value = input;
        int.message.edit({ content: int.message.content, embeds: [em], components: replyOption });
        return int.channel?.send(`> Updated ${is ? "Issue" : "Root Cause"} from "${past}" to "${input}"`);
      } else {
        int.message.edit({ content: int.message.content, embeds: [is ? u.embed(em).addFields({ name: "Issue", value: input }) : u.embed(em).addFields({ name: "Root Cause", value: input })], components: replyOption });
        return int.channel?.send(`> Set ${is ? "Issue" : "Root Cause"} to ${input}`);
      }
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

