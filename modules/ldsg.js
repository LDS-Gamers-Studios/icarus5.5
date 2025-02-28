// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js"),
  /** @type {string[]} */
  banned = require("../data/banned.json").features.suggestions;

const hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/;
const affiliateLinks = {
// amazon: { //Functionality can be renabled if amazon will let us get a affiliate
  //  site: "Amazon",
  //  affiliate: "Amazon Affiliate",
  //  test: /amazon\.(com|co\.uk)\/(\w+(-\w+)*\/)?(gp\/product|dp)\/(\w+)/i,
  //  tag: /tag=ldsgamers-20/,
  //  link: (match) => `https://www.${match[0]}?tag=ldsgamers-20`
  //  },
  cdkeys: {
    site: "CDKeys.com",
    affiliate: "CDKeys Affiliate",
    test: /cdkeys\.com(\/\w+(-\w+)*)*/i,
    tag: /mw_aref=LDSGamers/i,
    // eslint-disable-next-line jsdoc/no-undefined-types
    /** @param {RegExpExecArray} match */
    link: match => `https://www.${match[0]}?mw_aref=LDSGamers`
  },
// humblebundle: {
  // site: "Humble Bundle",
  //  affiliate: "Humble Bundle Partner",
  //  test: /humblebundle\.com(\/\w+(-\w+)*)*/i,
  //  tag: /partner=ldsgamers/i,
  //  link: (match) => `https://www.${match[0]}?partner=ldsgamers`
// },
};

/** @param {Discord.Message} msg */
function processLinks(msg) {
  for (const x in affiliateLinks) {
    const site = affiliateLinks[x];
    const match = site.test.exec(msg.cleanContent);
    if (match && !site.tag.test(msg.cleanContent)) {
      msg.reply(`You can help LDSG by using our [${site.affiliate} Link](${site.link(match)})`);
    }
  }
}

// suggestion modals
const replyModal = (user = true) => new u.Modal().addComponents(
  u.ModalActionRow().addComponents([
    new u.TextInput()
      .setCustomId("update")
      .setLabel("Message")
      .setStyle(Discord.TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(`Send an update to ${user ? "the user" : "Team"}`)
  ])
).setCustomId("suggestionReplyModal").setTitle("Suggestion Reply");

/**
 * Responds with the number of guild members, and how many are online.
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 */
async function slashLdsgMembers(interaction) {
  try {
    const ldsg = interaction.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("Couldn't find LDSG");
    const online = ldsg.members.cache.filter((member) => member?.presence && member.presence.status !== "offline");
    interaction.reply(`📈 **Members:**\n${ldsg.memberCount} Members\n${online.size} Online`);
  } catch (error) { u.errorHandler(error, interaction); }
}

const sTeamReply = new u.Button().setCustomId("suggestionTeamReply").setEmoji("🗨️").setLabel("Reply to user").setStyle(Discord.ButtonStyle.Primary);
const sUserReply = new u.Button().setCustomId("suggestionUserReply").setEmoji("🗨️").setLabel("Respond").setStyle(Discord.ButtonStyle.Primary);
const replyOption = [
  u.MessageActionRow().setComponents([
    sTeamReply,
    new u.Button().setCustomId("suggestionManage").setEmoji("✏️").setLabel("Manage Ticket").setStyle(Discord.ButtonStyle.Primary),
  ])
];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashLdsgSuggest(int) {
  if (banned.includes(int.user.id)) return int.editReply("Sorry, but you aren't allowed to make suggestions right now. Reach out to MGMT if you have questions.");
  const suggestion = int.options.getString("suggestion", true);
  await int.deferReply({ ephemeral: true });

  // create the thread
  const thread = await int.client.getForumChannel(u.sf.channels.suggestionBox)?.threads.create({ name: `Suggestion from ${int.user.displayName}`, message: { content: suggestion, components: replyOption } }).catch(u.noop);
  if (!thread) return int.editReply("Sorry, I ran into an error while submitting your suggestion.");

  // create the embed with the correct footer
  const embed = u.embed({ author: int.user })
    .setTitle("Suggestion")
    .setDescription(suggestion)
    .setFooter({ text: `${int.user.id} ${thread.id}` });

  // edit the message
  const msg = await thread.fetchStarterMessage();
  msg?.edit({ embeds: [embed] });

  int.editReply("Sent!");
  return int.user.send({
    content: "You have sent the following suggestion to the LDSG Team for review:",
    embeds: [embed],
    components: [u.MessageActionRow().setComponents(sUserReply)]
  });
}

/**
 * For messages from team to suggesters
 * @param {Discord.ButtonInteraction<"cached">} int
*/
async function suggestTeamReply(int) {
  const embed = u.embed(int.message.embeds[0]);

  // get user input
  await int.showModal(replyModal());
  const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true, filter: (i) => i.customId === "suggestionReplyModal" }).catch(u.noop);
  if (!submitted) return int.followUp({ content: "I fell asleep waiting for your input...", ephemeral: true });
  await submitted.deferUpdate();

  const reply = submitted.fields.getTextInputValue("update");

  // generate reply embed
  const em = u.embed({ author: int.user })
    .setTitle("📥 Message from Team")
    .setDescription(embed.data.description ?? null)
    .addFields({ name: "Update:", value: reply })
    .setFooter({ text: embed.data.footer?.text ?? "" });

  // send the reply
  const userId = (embed?.data.footer?.text ?? "").split(" ")[0];
  const member = int.guild.members.cache.get(userId);
  if (!member) return int.channel?.send("I could not find that member");

  try {
    await member.send({ embeds: [em], components: [u.MessageActionRow().setComponents(sUserReply)] });
    em.setTitle("📤 Message to Requester")
      .addFields({ name: "Prior Message", value: int.message.url });
    return int.channel?.send({ content: `Message sent to ${member.displayName}`, embeds: [em], components: [u.MessageActionRow().setComponents(sTeamReply)] });
  } catch (e) {
    return int.channel?.send(`Failed to message ${member}, they may have me blocked. You will need to reach out to them on your own this time!`);
  }
}

/**
 * For messages from the requester to team
 * @param {Discord.ButtonInteraction} int
 */
async function suggestionUserReply(int) {
  const embed = u.embed(int.message.embeds[0]);

  // get user input
  await int.showModal(replyModal(false));
  const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true, filter: (i) => i.customId === "suggestionReplyModal" }).catch(u.noop);
  if (!submitted) return int.followUp({ content: "I fell asleep waiting for your input...", ephemeral: true });
  await submitted.deferReply();

  const threadId = (embed.data.footer?.text ?? "").split(" ")[1];
  const thread = await int.client.channels.fetch(threadId).catch(u.noop);
  if (!thread || !thread.isThread()) return submitted.editReply("I could not find your suggestion thread.");

  // generate reply embed
  const reply = submitted.fields.getTextInputValue("update");
  const em = u.embed({ author: int.user })
    .setTitle("📥 Message from Requester")
    .addFields({ name: "Message:", value: reply })
    .setFooter({ text: embed.data.footer?.text ?? "" });

  // send the reply
  try {
    await thread.send({ embeds: [em], components: [u.MessageActionRow().setComponents([sTeamReply])] });
    em.setTitle("📤 Message to Team");
    return submitted.editReply({ embeds: [em], components: [u.MessageActionRow().setComponents([sUserReply])] });
  } catch (e) {
    return submitted.editReply("Failed to message the thread");
  }
}

/** @param {Discord.ButtonInteraction<"cached">} int */
async function suggestManage(int) {
  // make sure everything is good
  if (!int.channel) return int.reply({ content: "I couldn't access the channel you're in!", ephemeral: true });
  if (int.channel.parentId !== u.sf.channels.team.suggestionBox) return int.reply({ content: `This can only be done in <#${u.sf.channels.team.suggestionBox}>!`, ephemeral: true });

  // create modal
  const oldFields = (int.message.embeds[0]?.fields || []);
  const manageModal = new u.Modal().addComponents(
    u.ModalActionRow().addComponents([
      new u.TextInput()
        .setCustomId("title")
        .setLabel("Title")
        .setStyle(Discord.TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("New title for the forum post")
        .setValue(int.channel.name)
    ]),
    u.ModalActionRow().addComponents([
      new u.TextInput()
        .setCustomId("issue")
        .setLabel("Set Issue")
        .setStyle(Discord.TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("What issue is the user facing?")
        .setValue(oldFields.find(f => f.name === "Issue")?.value ?? "")
    ]),
    u.ModalActionRow().addComponents([
      new u.TextInput()
        .setCustomId("plans")
        .setLabel("Plans")
        .setStyle(Discord.TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder("Plans and actions to take")
        .setValue(oldFields.find(f => f.name === "Plans")?.value ?? "")
    ])
  ).setCustomId("suggestionManageModal").setTitle("Manage Suggestion");

  // get user input
  await int.showModal(manageModal);
  const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true, filter: (i) => i.customId === "suggestionManageModal" }).catch(u.noop);
  if (!submitted) return int.followUp({ content: "I fell asleep waiting for your input...", ephemeral: true });
  await submitted.deferReply({ ephemeral: true });
  const title = submitted.fields.getTextInputValue("title");
  const issue = submitted.fields.getTextInputValue("issue");
  const plans = submitted.fields.getTextInputValue("plans");

  // change the embed
  const em = u.embed(int.message.embeds[0]);
  if (title && title !== int.channel.name) {
    try {
      await int.channel.setName(title);
      em.setTitle(title);
    } catch (e) {
      u.errorHandler(e, int);
    }
  } else if (!title) {
    const user = int.guild.members.cache.get(em.data.footer?.text ?? "")?.displayName ?? em.data.footer?.text;
    await int.channel.setName(`Suggestion from ${user}`);
  }
  const fields = [];
  if (issue) fields.push({ name: "Issue", value: issue });
  if (plans) fields.push({ name: "Plans", value: plans });
  em.setFields(fields);
  await submitted.editReply("Suggestion updated!");
  int.channel.send({ content: `Suggestion updated:\n${int.message.url}`, embeds: [em] });
  return await int.message.edit({ content: int.message.content, embeds: [em] });
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
        default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
      }
    }
  })
  .addEvent("interactionCreate", (int) => {
    if (!int.isButton()) return;
    if (int.customId === "suggestionUserReply" && !int.inGuild()) return suggestionUserReply(int);
    if (!int.inCachedGuild() || int.guild.id !== u.sf.ldsg) return;
    if (!int.customId.startsWith("suggestion")) return;
    if (!u.perms.calc(int.member, ["team", "mgr"])) {
      return int.reply({ content: "You don't have permissions to interact with this suggestion!", ephemeral: true });
    }
    switch (int.customId) {
      case "suggestionTeamReply": return suggestTeamReply(int);
      case "suggestionManage": return suggestManage(int);
      default: return;
    }
  })
  .addEvent("messageCreate", (msg) => {
    if (hasLink.test(msg.cleanContent)) {
      processLinks(msg);
    }
  });

module.exports = Module;

