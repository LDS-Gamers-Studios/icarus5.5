// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js"),
  { ButtonStyle } = require("discord.js");

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
    await interaction.reply({ content: response });
  } catch (error) { u.errorHandler(error, interaction); }
}

const sendOptions = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("pa").setEmoji("🗣️").setLabel("Public Affairs").setStyle(ButtonStyle.Success),
    new u.Button().setCustomId("log").setEmoji("🚚").setLabel("Logistics").setStyle(ButtonStyle.Success),
    new u.Button().setCustomId("ops").setEmoji("🗓️").setLabel("Operations").setStyle(ButtonStyle.Success),
    new u.Button().setCustomId("mgmt").setEmoji("⚙️").setLabel("Management").setStyle(ButtonStyle.Primary),
    new u.Button().setCustomId("icarus").setEmoji("🤖").setLabel("Icarus").setStyle(ButtonStyle.Primary),
  ]),
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("ignore").setEmoji("⚠️").setLabel("Ignore").setStyle(ButtonStyle.Danger),
  ])
];

const replyOption = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("reply").setEmoji("🗨️").setLabel("Reply to user").setStyle(ButtonStyle.Primary)
  ])
];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashLdsgSuggest(int) {
  const suggestion = int.options.getString("suggestion", true);
  await int.deferReply({ ephemeral: true });
  const embed = u.embed({ author: int.user })
    .addFields({ name: "User ID:", value: int.user.id }, { name: "Suggestion:", value: suggestion });
  await int.client.getTextChannel(u.sf.channels.suggestionBox)?.send({ embeds: [embed], components: sendOptions });
  int.editReply("Sent!");
  return int.user.send({ content: "Sent:", embeds: [embed] });
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
          .setPlaceholder("Your reply for the user")
      ])
    ).setCustomId("suggestionReply").setTitle("Suggestion Reply");
    let submitted;
    let em;
    let reply;
    let member;
    /** @type {String} */
    let channel;
    switch (int.customId) {
      case "pa":
        channel = u.sf.channels.publicaffairsForum;
        break;
      case "log":
        channel = u.sf.channels.logisticsForum;
        break;
      case "ops":
        channel = u.sf.channels.operationsForum;
        break;
      case "icarus":
        channel = u.sf.channels.bottestingForums;
        break;
      case "mgmt":
        channel = u.sf.channels.managementForum;
        break;
      case "reply":
        await int.showModal(modal);
        submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
          return null;
        });
        if (!submitted) {
          return int.channel?.send("I fell asleep waiting for your input...");
        }
        await submitted.deferUpdate();
        reply = submitted.fields.getTextInputValue("text");
        em = u.embed({ author: int.user })
          .setTitle("Suggestion feedback")
          .addFields({ name: "Reply:", value: reply });
        member = int.guild.members.cache.get(suggestion.embeds[0].fields.find(field => field.name === "User ID:")?.value ?? "");
        if (!member) {
          return int.channel?.send("I could not find that member");
        }
        try {
          member.send({ embeds: [em] });
          return int.channel?.send({ content: "Replied to user:", embeds: [em] });
        } catch (e) {
          u.errorHandler(e, int);
          return int.channel?.send("Failed to message member, they may have me blocked. You will need to reach out to them on your own this time!");
        }
      case "ignore":
        embed.addFields({ name: `Suggestion ignored`, value: `by ${int.user}` });
        return int.update({ embeds: [embed], components: [] });
      default:
        channel = "Channel not found";
    }
    embed.addFields({ name: `Sent to <#${channel}>`, value: `by ${int.user}` });
    int.client.getForumChannel(channel)?.threads.create({ name: `Suggestion from ${suggestion.embeds[0].author?.name}`, message: { embeds: [suggestion.embeds[0]], components: replyOption } });
    return int.update({ embeds: [embed], components: [] });
  } catch (e) { u.errorHandler(e, int); }
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
    if (!u.perms.calc(int.member, ["team"])) {
      return int.reply({ content: "You don't have permissions to interact with this suggestion!", ephemeral: true });
    }
    if (['pa', 'log', 'ops', 'icarus', 'reply', 'mgmt', 'ignore']
      .includes(int.customId)) return processCardAction(int);
  });

module.exports = Module;

