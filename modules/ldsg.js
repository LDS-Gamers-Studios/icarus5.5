// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  config = require("../config/config.json"),
  Discord = require("discord.js"),
  /** @type {string[]} */
  banned = require("../data/banned.json").features.suggestions;

/** @typedef {import("../database/controllers/tag").tag} tag */

const hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/;
const affiliateLinks = [
  // { //Functionality can be renabled if amazon will let us get a affiliate
  //  site: "Amazon",
  //  affiliate: "Amazon Affiliate",
  //  test: /amazon\.(com|co\.uk)\/(\w+(-\w+)*\/)?(gp\/product|dp)\/(\w+)/i,
  //  tag: /tag=ldsgamers-20/,
  /** @param {string} match */
  //  link: (match) => `https://www.${match[0]}?tag=ldsgamers-20`
  // },
  {
    site: "CDKeys.com",
    affiliate: "CDKeys Affiliate",
    test: /cdkeys\.com(\/\w+(-\w+)*)*/i,
    tag: /mw_aref=LDSGamers/i,
    /** @param {string} match */
    link: match => `https://www.${match}?mw_aref=LDSGamers`
  },
  // {
  //  site: "Humble Bundle",
  //  affiliate: "Humble Bundle Partner",
  //  test: /humblebundle\.com(\/\w+(-\w+)*)*/i,
  //  tag: /partner=ldsgamers/i,
  /** @param {string} match */
  //  link: (match) => `https://www.${match[0]}?partner=ldsgamers`
  // },
];

/** @param {Discord.Message} msg */
function processLinks(msg) {
  for (const site of affiliateLinks) {
    const match = site.test.exec(msg.cleanContent);
    if (match && !site.tag.test(msg.cleanContent)) {
      msg.reply(`You can help LDSG by using our [${site.affiliate} Link](${site.link(match[0])})`);
    }
  }
}

// suggestion modals
const replyModal = new u.Modal().addComponents(
  u.ModalActionRow().addComponents([
    new u.TextInput()
      .setCustomId("update")
      .setLabel("Message")
      .setStyle(Discord.TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Send an update to the user")
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

const replyOption = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("suggestionReply").setEmoji("🗨️").setLabel("Reply to user").setStyle(Discord.ButtonStyle.Primary),
    new u.Button().setCustomId("suggestionManage").setEmoji("✏️").setLabel("Manage Ticket").setStyle(Discord.ButtonStyle.Primary),
  ])
];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashLdsgSuggest(int) {
  if (banned.includes(int.user.id)) return int.editReply("Sorry, but you aren't allowed to make suggestions right now. Reach out to MGMT if you have questions.");
  const suggestion = int.options.getString("suggestion", true);
  await int.deferReply({ flags: ["Ephemeral"] });
  const embed = u.embed({ author: int.user })
    .setTitle("Suggestion")
    .setDescription(suggestion)
    .setFooter({ text: int.user.id });
  await int.client.getForumChannel(u.sf.channels.team.suggestionBox)?.threads.create({ name: `Suggestion from ${int.user.displayName}`, message: { content: suggestion, embeds: [embed], components: replyOption } });
  int.editReply("Sent!");
  return int.user.send({ content: "You have sent the following suggestion to the LDSG Team for review:", embeds: [embed] });
}

/** @param {Discord.ButtonInteraction<"cached">} int */
async function suggestReply(int) {
  const embed = u.embed(int.message.embeds[0]);
  // get user input
  await int.showModal(replyModal);
  const submitted = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true, filter: (i) => i.customId === "suggestionReplyModal" }).catch(u.noop);
  if (!submitted) return int.followUp({ content: "I fell asleep waiting for your input...", flags: ["Ephemeral"] });
  await submitted.deferUpdate();

  // generate reply embed
  const reply = submitted.fields.getTextInputValue("update");
  const em = u.embed({ author: int.user })
    .setTitle("Suggestion Update")
    .setDescription(embed.data.description ?? "")
    .addFields({ name: "Update:", value: reply })
    .setFooter({ text: `-LDSG Team` });

  // send the reply
  const member = int.guild.members.cache.get(embed.data.footer?.text ?? "");
  if (!member) return int.channel?.send("I could not find that member");
  try {
    member.send({ embeds: [em] });
    return int.channel?.send({ content: `Message sent to ${member.displayName}:\n${int.message.url}`, embeds: [em] });
  } catch (e) {
    return int.channel?.send(`Failed to message ${member}, they may have me blocked. You will need to reach out to them on your own this time!`);
  }
}

/** @param {Discord.ButtonInteraction<"cached">} int */
async function suggestManage(int) {
  // make sure everything is good
  if (!int.channel) return int.reply({ content: "I couldn't access the channel you're in!", flags: ["Ephemeral"] });
  if (int.channel.parentId !== u.sf.channels.team.suggestionBox) return int.reply({ content: `This can only be done in <#${u.sf.channels.team.suggestionBox}>!`, flags: ["Ephemeral"] });

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
  if (!submitted) return int.followUp({ content: "I fell asleep waiting for your input...", flags: ["Ephemeral"] });
  await submitted.deferReply({ flags: ["Ephemeral"] });
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

  /** @type {{ name: string, value: string }[]} */
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
    options: { registry: "slashLdsg" },
    onlyGuild: true,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true).toLowerCase();
      switch (subcommand) {
        case "members": return slashLdsgMembers(interaction);
        case "suggest": return slashLdsgSuggest(interaction);

        // these commands are static tags
        default: {
          /** @type {import("./tags").Shared} */
          const tu = interaction.client.moduleManager.shared.get("tags.js");
          if (!tu) return u.errorHandler(new Error("Couldn't get Tag Utils"), interaction);

          const tag = tu.tags.get(subcommand);
          if (!tag) return u.errorHandler(new Error("Unhandled Subcommand"), interaction);

          const encoded = tu.encodeTag(tag, null, interaction);

          // if its a string then its an error message
          if (typeof encoded === "string") return interaction.reply({ content: encoded, ephemeral: true });

          encoded.content = (encoded.content ?? "") + `\n-# This command can also be run via \`${config.prefix}${subcommand}\``;
          return interaction.reply(encoded);
        }
      }
    }
  })
  .addEvent("interactionCreate", (int) => {
    if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;
    if (!int.customId.startsWith("suggestion")) return;
    if (!u.perms.calc(int.member, ["team", "mgr"])) {
      return int.reply({ content: "You don't have permissions to interact with this suggestion!", flags: ["Ephemeral"] });
    }
    switch (int.customId) {
      case "suggestionReply": return suggestReply(int);
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

