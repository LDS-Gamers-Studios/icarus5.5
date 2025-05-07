// @ts-check

const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  fs = require('fs'),
  axios = require('axios'),
  config = require('../config/config.json'),
  u = require("../utils/utils");

/** @typedef {import("../database/controllers/tag").tag} tag */

/**
 * @param {Discord.Attachment} attachment
 * @param {{ _id: import("mongoose").Types.ObjectId }} cmd
*/
async function saveAttachment(attachment, cmd) {
  // @ts-ignore axios hates correct types
  const response = await axios({
    method: "get",
    url: attachment.url,
    responseType: "stream",
  });
  response.data.pipe(fs.createWriteStream(config.tagFilePath + "/" + cmd._id.toString()));
}

/** @type {Discord.Collection<string, tag>} */
const tags = new Discord.Collection();

/** @param {Discord.Message} msg */
function runTag(msg) {
  const cmd = u.parse(msg);
  if (!msg.channel.isSendable() || !cmd) return;

  const tag = tags.get(cmd.command);
  if (!tag) return;

  const encoded = encodeTag(tag, msg);
  const send = typeof encoded === "string" ? { content: encoded } : encoded;

  msg.reply({ ...send, allowedMentions: { parse: [] } }).then(m => {
    if (typeof encoded === "string") u.clean(m);
  }).catch(u.noop);
}


/**
 * @param {import("../database/controllers/tag").tag} tag
 * @param {Discord.Message | null} msg
 * @param {Discord.ChatInputCommandInteraction} [int]
 */
function encodeTag(tag, msg, int) {
  const user = msg?.inGuild() ? msg.member : int?.inCachedGuild() ? int.member : int?.user ?? msg?.author ?? null;
  const origin = msg ?? int;
  if (!user || !origin) return "I couldn't process that command!";

  let response = tag.response;

  let target = msg?.mentions.members?.first() || msg?.mentions.users.first();
  if (response) {
    const randomChannels = origin.guild ? origin.guild.channels.cache.filter(c =>
      c.isTextBased() && !c.isThread() && // normal text channel
      !c.permissionOverwrites?.cache.get(origin.guild?.id ?? "")?.deny?.has("ViewChannel") // public channel
    ).map(c => c.toString()) : ["Here"];

    const randRegex = /<@random ?\[(.*?)\]>/gim;
    if (randRegex.test(response)) {
      response = response.replace(randRegex, (str) => u.rand(str.replace(randRegex, '$1').split('|')));
    }

    response = response
      .replace(/<#channel>/ig, origin.channel?.toString() ?? "Here")
      .replace(/<#randomchannel>/ig, u.rand(randomChannels) || origin.channel?.toString() || "Here")
      .replace(/<@author>/ig, user.toString())
      .replace(/<@authorname>/ig, user.displayName);

    if ((/(<@target>)|(<@targetname>)/ig).test(response)) {
      if (!origin.guild) target ??= origin.client.user;
      if (!target) return "You need to `@mention` a user with that command!";
      response = response
        .replace(/<@target>/ig, target.toString())
        .replace(/<@targetname>/ig, target.displayName);
    }
  }
  return {
    content: response ?? undefined,
    files: tag.attachment ? [new u.Attachment(`${config.tagFilePath}/${tag._id}`).setName(tag.attachment)] : [],
    allowedMentions: { users: target ? [target.id, user.id] : [user.id] }
  };
}

/***
 * @param {Discord.EmbedBuilder} embed
 * @param {tag} command
 */
function deleteAttachment(embed, command) {
  embed.addFields({ name: "Attachment", value: "[Deleted]" });
  const path = `${config.tagFilePath}/${command._id.toString()}`;
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagSet(int) {
  // Get and validate input
  const name = int.options.getString('name', true).toLowerCase().replace(/[ \n]/g, "");
  const oldTag = tags.get(name);

  const row = u.ModalActionRow();
  row.addComponents(
    new u.TextInput()
      .setCustomId("content")
      .setLabel("Content (optional)")
      .setPlaceholder("Leave blank for no content")
      .setRequired(false)
      .setStyle(Discord.TextInputStyle.Paragraph)
      .setValue(oldTag?.response ?? "")
      .setMaxLength(2000)
  );
  const modal = new u.Modal().addComponents(row)
    .setTitle("Tag Content")
    .setCustomId("tagContent");

  await int.showModal(modal);
  const content = await int.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(u.noop);
  if (!content) return int.followUp({ content: "I fell asleep waiting for your input!", flags: ["Ephemeral"] });

  await content.deferReply({ flags: ["Ephemeral"] });
  const response = content.fields.getTextInputValue("content") || null;
  const attachment = int.options.getAttachment('attachment');

  if (!response && !attachment) return content.editReply(`I need a response, a file, or both. If you want to delete the tag, use </tag delete:${u.sf.commands.slashTag}>.`);

  // Create or modify the tag
  const command = await u.db.tags.manageTag({
    tag: name,
    response: response,
    attachment: attachment?.name || null,
    attachmentMime: attachment?.contentType || null
  });

  if (!command) return content.editReply("I wasn't able to save that. Please try again later or with a different name.");

  let description = `${int.member} set the tag \`${name}\``;

  if (oldTag && oldTag.response !== command.response) {
    description += `\n\n**Old Tag Content:** \n${oldTag?.response || "None"}`;
    if (!command.response) description += "\n\n**New Tag Content:** \nNone";
  }

  if (command.response) description += `\n\n**New Tag Content:**\n${command.response}`;

  const embed = u.embed({ author: int.member })
    .setTitle("Tag Saved")
    .setDescription(description);

  if (attachment) {
    embed.addFields({ name: "Attachment", value: "[Uploaded]" });
    saveAttachment(attachment, command);
  } else if (oldTag?.attachment) {
    deleteAttachment(embed, command);
  }

  tags.set(command.tag, command);

  // report the tag creation
  const alerts = await int.client.getTextChannel(u.sf.channels.team.team)?.threads.fetch(u.sf.channels.team.tags);
  alerts?.send({ embeds: [embed], files: attachment ? [attachment] : undefined }).catch(() => {
    embed.setDescription(`${int.member} set the tag \`${name}\`\n\nError: The tag save preview was too long to send`);
    alerts?.send({ embeds: [embed] });
  });

  content.editReply({ content: "Tag Saved!", embeds: [embed.setDescription(`Try it out with \`${config.prefix}${name}\``)], files: attachment ? [attachment] : [] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagDelete(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  const name = int.options.getString('name', true).toLowerCase().replace(/[ \n]/g, "");
  if (!tags.has(name)) return int.editReply(`Looks like that tag doesn't exist.`);

  const command = await u.db.tags.deleteTag(name);
  if (!command) return int.editReply("I wasn't able to delete that. Please try again later or contact a dev to see what went wrong.");
  tags.delete(name);

  let description = `${int.member} deleted the tag \`${name}\``;
  if (command.response) description += `\n\n**Tag Content:**\n${command.response}`;

  const embed = u.embed({ author: int.member })
    .setTitle("Tag Deleted")
    .setDescription(description);

  if (command.attachment) deleteAttachment(embed, command);

  const alerts = await int.client.getTextChannel(u.sf.channels.team.team)?.threads.fetch(u.sf.channels.team.tags);
  alerts?.send({ embeds: [embed] }).catch(() => {
    embed.setDescription(`${int.member} deleted the tag \`${name}\`\n\nError: The tag deletion preview was too long to send`);
    alerts?.send({ embeds: [embed] });
  });

  int.editReply({ embeds: [embed.setDescription(null)] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function slashTagVariables(int) {
  const placeholderDescriptions = [
    "`<@author>`: Pings the user",
    "`<@authorname>`: The user's nickname",
    "`<@target>`: Pings someone who is pinged by the user",
    "`<@targetname>`: The nickname of someone who is pinged by the user",
    "`<#channel>`: The channel the command is used in",
    "`<#randomchannel>` A random public channel",
    "`<@random [item1|item2|item3...]>`: Randomly selects one of the items. Separate with `|`. (No, there can't be `<@random>`s inside of `<@random>`s)",
    "",
    "Example: <@target> took over <#channel>, and <@author> <@random [is complicit|might have something to say about it]>."
  ];
  const embed = u.embed()
    .setTitle("Tag Placeholders")
    .setDescription(`You can use these when creating or modifying tags for some user customization. The \`<@thing>\` gets replaced with the proper value when the command is run. \n\n${placeholderDescriptions.join('\n')}`);

  return int.reply({ embeds: [embed], flags: ["Ephemeral"] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagValue(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  const name = int.options.getString('name', true).toLowerCase().replace(/[ \n]/g, "");
  const tag = tags.get(name);
  if (!tag) return int.editReply(`Looks like that tag doesn't exist.`);

  const embed = u.embed({ author: int.member })
    .setTitle(tag.tag)
    .setDescription(tag.response || null);
  return int.editReply({ embeds: [embed], files: tag.attachment ? [new u.Attachment(`${config.tagFilePath}/${tag._id}`).setName(tag.attachment)] : [] });
}

const Module = new Augur.Module()
.addInteraction({
  name: "tag",
  id: u.sf.commands.slashTag,
  onlyGuild: true,
  options: { registry: "slashTag" },
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
      case "set": return slashTagSet(int);
      case "delete": return slashTagDelete(int);
      case "variables": return slashTagVariables(int);
      case "value": return slashTagValue(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const focusedValue = int.options.getFocused()?.toLowerCase();
    const filtered = tags.filter(tag => tag.tag.toLowerCase().includes(focusedValue));
    return int.respond(filtered.map(choice => ({ name: choice.tag, value: choice.tag })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 24));
  }
})
.addEvent("messageCreate", async (msg) => {
  if (!msg.author.bot) return runTag(msg);
})
.addEvent("messageEdit", async (oldMsg, msg) => {
  if (!msg.author.bot) return runTag(msg);
})
.setInit(async () => {
  try {
    const cmds = await u.db.tags.fetchAllTags();
    cmds.forEach(c => tags.set(c.tag.toLowerCase(), c));
  } catch (error) { u.errorHandler(error, "Load Custom Tags"); }
})
.setShared({ tags, encodeTag });

/** @typedef {{ tags: tags, encodeTag: encodeTag } | undefined} Shared */

module.exports = Module;