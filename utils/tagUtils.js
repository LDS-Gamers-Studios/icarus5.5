// @ts-check
const Discord = require("discord.js");
/** @type {Discord.Collection<string, import("../database/controllers/tag").tag>} */
const tags = new Discord.Collection();
const u = require("./utils");

/**
 * @param {import("../database/controllers/tag").tag} tag
 * @param {Discord.Message | null} msg
 * @param {Discord.ChatInputCommandInteraction} [int]
 */
function encodeTag(tag, msg, int) {
  let response = tag.response;
  const user = msg?.inGuild() ? msg.member : int?.inCachedGuild() ? int.member : int?.user ?? msg?.author ?? null;
  const origin = msg ?? int;
  if (!user || !origin) return "I couldn't process that command!";
  let target = msg?.mentions.members?.first() || msg?.mentions.users.first();
  if (response) {
    const randomChannels = origin.guild ? origin.guild.channels.cache.filter(c =>
      c.isTextBased() && !c.isThread() && // normal text channel
      !c.permissionOverwrites?.cache.get(origin.guild?.id ?? "")?.deny?.has("ViewChannel") // public channel
    ).map(c => c.toString()) : ["Here"];

    const regex = /<@random ?\[(.*?)\]>/gim;
    if (regex.test(response)) {
      response = response.replace(regex, (str) => u.rand(str.replace(regex, '$1').split('|')));
    }

    response = response
      .replace(/<@channel>/ig, origin.channel?.toString() ?? "Here")
      .replace(/<@randomchannel>/, u.rand(randomChannels) ?? origin.channel?.toString() ?? "Here")
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
    files: tag.attachment ? [new u.Attachment(`./media/tags/${tag._id}`).setName(tag.attachment)] : [],
    allowedMentions: { users: target ? [target.id, user.id] : [user.id] }
  };
}

module.exports = { tags, encodeTag };