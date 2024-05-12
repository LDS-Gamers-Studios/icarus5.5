// @ts-check

const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  fs = require('fs'),
  axios = require('axios'),
  u = require("../utils/utils");

/**
 * @type {Discord.Collection<string, {tag: string, response?: string, attachment?: string, _id: import("mongoose").Types.ObjectId}>}
 */
let tags = new u.Collection();

/**
 * @param {string | undefined} tag The tag name to find
 */
const findTag = (tag) => tag ? tags.find(t => t.tag.toLowerCase() == tag.toLowerCase()) ?? null : null;

/**
 * @param {Discord.Attachment} attachment
 * @param {{_id: import("mongoose").Types.ObjectId}} cmd
*/
async function saveAttachment(attachment, cmd) {
  // @ts-ignore axios hates correct types
  const response = await axios({
    method: "get",
    url: attachment.url,
    responseType: "stream",
  });
  response.data.pipe(fs.createWriteStream(process.cwd() + "/media/tags/" + cmd._id.toString()));
}

/** @param {Discord.Message} msg */
function runTag(msg) {
  const cmd = u.parse(msg);
  const tag = findTag(cmd?.command);

  if (!tag) return;
  let response = tag.response;
  let target = msg.mentions?.members?.first() || msg.mentions?.users?.first();

  if (response) {
    const randomChannels = msg.inGuild() ? msg.guild.channels.cache.filter(c =>
      c.isTextBased() && !c.isThread() &&
      !c.permissionOverwrites?.cache.get(msg.guild.id)?.deny?.has("ViewChannel")
    ).map(c => c.toString()) : ["Here"];

    const regex = /<@random ?\[(.*?)\]>/gm;
    if (regex.test(response)) {
      const replace = (/** @type {string} */ str) => u.rand(str.replace(regex, '$1').split('|'));
      response = response.replace(regex, replace);
    }
    response = response
      .replace(/<@author>/ig, msg.author.toString())
      .replace(/<@authorname>/ig, msg.member?.displayName || msg.author.username)
      .replace(/<@channel>/ig, msg.channel.toString())
      .replace(/<@randomchannel>/, u.rand(randomChannels) ?? msg.channel.toString());
    if ((/(<@target>)|(<@targetname>)/ig).test(response)) {
      if (!msg.guild) target ??= msg.client.user;
      if (!target) return msg.reply("You need to `@mention` a user with that command!").then(u.clean);
      response = response.replace(/<@target>/ig, target.toString())
        .replace(/<@targetname>/ig, target.displayName);
    }
  }
  msg.channel.send({
    content: response ?? undefined,
    files: tag.attachment ? [new u.Attachment(`./media/tags/${tag._id}`).setName(tag.attachment)] : [],
    allowedMentions: { users: target ? [target.id, msg.author.id] : [msg.author.id] }
  });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagCreate(int) {
  // Get and validate input
  const name = int.options.getString('name', true).toLowerCase().replace("\n", " ");
  const content = int.options.getString('content');
  const attachment = int.options.getAttachment('attachment');
  if (findTag(name)) return int.editReply(`Looks like that tag already exists. Try </tag modify:${u.sf.commands.slashTag}> or </tag delete:${u.sf.commands.slashTag}> instead.`);
  if (!content && !attachment) return int.editReply("I either need content or a file.");
  // Create the tag
  const command = await u.db.tags.manageTag({
    tag: name,
    response: content ?? undefined,
    attachment: attachment?.name
  });
  if (!command) return int.editReply("I wasn't able to save that. Please try again later or with a different name.");
  if (attachment) saveAttachment(attachment, command);

  tags.set(command.tag, command);
  const embed = u.embed({ author: int.member })
    .setTitle("Tag created")
    .setDescription(`${int.member} added the tag \`${name}\``);
  if (command.response) embed.addFields({ name: "Response", value: command.response });
  try {
    // report the tag creation
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed], files: attachment ? [attachment] : [] });
    int.editReply({ content: "Tag created!", embeds: [embed.setDescription(`Try it out with \`!${name}\``)], files: attachment ? [attachment] : [] });
  } catch (error) {
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed.setFields({ name: "Error", value: "The tag creation preview was too long to send." })] });
    int.editReply(`I saved the tag \`${name}\`, but I wasn't able to send you the preview`);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagModify(int) {
  // get and validate inputs
  const name = int.options.getString('name', true).toLowerCase().replace("\n", "");
  const content = int.options.getString('content');
  const attachment = int.options.getAttachment('attachment');
  const currentTag = findTag(name);
  if (!currentTag) return int.editReply(`Looks like that tag doesn't exist.`);
  if (!content && !attachment) return int.editReply(`I need a response, a file, or both. If you want to delete the tag, use </tag delete:<${u.sf.commands.slashTag}>.`);

  // modify the tag
  const command = await u.db.tags.manageTag({
    tag: name,
    response: content ?? undefined,
    attachment: attachment?.name
  });

  if (!command) return int.editReply("I wasn't able to update that. Please try again later or contact a dev to see what went wrong.");
  if (attachment) saveAttachment(attachment, command);

  tags.set(command.tag, command);
  const embed = u.embed({ author: int.member })
    .setTitle("Tag modified")
    .setDescription(`${int.member} modified the tag "${name}`);

  // log the modification
  try {
    if (command.response != currentTag.response) {
      embed.addFields(
        { name: "Old Response", value: currentTag.response ?? 'None' },
        { name: "New Response", value: command.response ?? 'None' },
        { name: "Attachment Status", value: currentTag.attachment ? attachment ? "Removed" : "Replaced" : attachment ? "Added" : "Unchanged" }
      );
    }
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed], files: attachment ? [attachment] : [] });
    int.editReply({ embeds: [embed.setDescription(null)] });
  } catch (error) {
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed.setFields({ name: "Error", value: "The tag change preview was too long to send" })] });
    int.editReply(`I saved the tag \`${name}\`, but I wasn't able to send you the preview`);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagDelete(int) {
  const name = int.options.getString('name', true).toLowerCase().replace("\n", "");
  if (!findTag(name)) return int.editReply(`Looks like that tag doesn't exist.`);
  const command = await u.db.tags.deleteTag(name);
  if (!command) return int.editReply("I wasn't able to delete that. Please try again later or contact a dev to see what went wrong.");
  const embed = u.embed({ author: int.member })
    .setTitle("Tag Deleted")
    .setDescription(`${int.member} removed the tag \`${name}\``);
  try {
    if (command.response) embed.addFields({ name: "Response", value: command.response });
    if (command.attachment) {
      embed.addFields({ name: "Attachment", value: "[Deleted]" });
      fs.rmSync(process.cwd() + `/media/tags/${command._id.toString()}`);
    }
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed] });
    int.editReply({ embeds: [embed.setDescription(null)] });
  } catch (err) {
    console.log(err);
    int.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed.setFields({ name: "Error", value: "The tag deletion preview was too long to send" })] });
    int.editReply(`I deleted the tag \`${name}\`, but I wasn't able to send you the preview`);
  }
  tags.delete(name);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagVariables(int) {
  const placeholderDescriptions = [
    "`<@author>`: Pings the user",
    "`<@authorname>`: The user's nickname",
    "`<@target>`: Pings someone who is pinged by the user",
    "`<@targetname>`: The nickname of someone who is pinged by the user",
    "`<@channel>`: The channel the command is used in",
    "`<@randomchannel>` A random public channel",
    "`<@random [item1|item2|item3...]>`: Randomly selects one of the items. Separate with `|`. (No, there can't be `<@random>`s inside of `<@random>`s)",
    "",
    "Example: <@target> took over <@channel>, but <@author> <@random is complicit|might have something to say about it>."
  ];
  const embed = u.embed().setTitle("Tag Placeholders").setDescription(`You can use these when creating or modifying tags for some user customization. The \`<@thing>\` gets replaced with the proper value when the command is run. \n\n${placeholderDescriptions.join('\n')}`);
  return int.editReply({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTagValue(int) {
  const name = int.options.getString('name', true).toLowerCase();
  const tag = findTag(name);
  if (!tag) return int.editReply(`Looks like that tag doesn't exist.`);
  const embed = u.embed({ author: int.member })
    .setTitle(tag.tag)
    .setDescription(tag.response ?? null)
    .setImage(tag.attachment ?? null);
  return int.editReply({ embeds: [embed] });
}

const Module = new Augur.Module()
.addInteraction({
  name: "tag",
  id: u.sf.commands.slashTag,
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    await int.deferReply({ ephemeral: true });
    switch (int.options.getSubcommand()) {
      case "create": return slashTagCreate(int);
      case "modify": return slashTagModify(int);
      case "delete": return slashTagDelete(int);
      case "variables": return slashTagVariables(int);
      case "value": return slashTagValue(int);
    }
  },
  autocomplete: (int) => {
    const focusedValue = int.options.getFocused()?.toLowerCase();
    const filtered = tags.filter(tag => tag.tag.toLowerCase().includes(focusedValue));
    return int.respond(filtered.map(choice => ({ name: choice.tag, value: choice.tag })).slice(0, 24));
  }
})
.addEvent("messageCreate", async (msg) => { if (!msg.author.bot) return runTag(msg); })
.addEvent("messageUpdate", async (oldMsg, msg) => {
  if (msg.partial) msg = await msg.fetch();
  if (!msg.author?.bot) return runTag(msg);
})
.setInit(async () => {
  try {
    const cmds = await u.db.tags.fetchAllTags();
    tags = new u.Collection(cmds.map(c => [c.tag, c]));
  } catch (error) { u.errorHandler(error, "Load Custom Tags"); }
});

module.exports = Module;