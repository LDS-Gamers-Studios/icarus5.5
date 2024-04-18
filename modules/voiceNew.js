// @ts-check
const Augur = require('augurbot-ts'),
  Discord = require('discord.js'),
  u = require('../utils/utils');


/** @typedef {(int: Augur.GuildInteraction<"Button">, channel: Discord.BaseGuildVoiceChannel) => Promise<any>} voice */
/** @type {Discord.Collection<string, string>} */
let owners = new u.Collection();

const styles = Discord.ButtonStyle;
/**
 * @param {updates} options
 * @return {Discord.ButtonBuilder[]}
 */
const buttons1 = (options) => [
  options.locked ? new Discord.ButtonBuilder().setCustomId("voiceUnlock").setLabel("Unlock").setEmoji("🔓").setStyle(styles.Secondary) :
    new Discord.ButtonBuilder().setCustomId("voiceLock").setLabel("Lock").setEmoji("🔒").setStyle(styles.Secondary),

  options.streamlocked ? new Discord.ButtonBuilder().setCustomId("voiceStreamUnlock").setLabel("Stream Unlock").setEmoji("🔓").setStyle(styles.Secondary) :
    new Discord.ButtonBuilder().setCustomId("voiceStreamLock").setLabel("Stream Lock").setEmoji("🔇").setStyle(styles.Secondary),

  new Discord.ButtonBuilder().setCustomId("voiceAllowUser").setLabel("Allow User").setEmoji("😎").setDisabled(!options.locked).setStyle(styles.Primary),
  new Discord.ButtonBuilder().setCustomId("voiceStreamAllow").setLabel("Allow to Speak").setEmoji("🗣️").setDisabled(!options.streamlocked).setStyle(styles.Primary),
  new Discord.ButtonBuilder().setCustomId("voiceStreamDeny").setLabel("Deny to Speak").setEmoji("🤐").setDisabled(!options.streamlocked).setStyle(styles.Danger),
];

const buttons2 = [
  new Discord.ButtonBuilder().setCustomId("voiceKickUser").setLabel("Kick User").setStyle(styles.Danger),
  new Discord.ButtonBuilder().setCustomId("voiceBanUser").setLabel("Ban User").setStyle(styles.Danger),
  new Discord.ButtonBuilder().setCustomId("voiceUnbanUser").setLabel("Unban User").setStyle(styles.Danger),
  new Discord.ButtonBuilder().setCustomId("voiceSetOwner").setLabel("Set New Owner").setStyle(styles.Danger)
];

/**
 * @param {updates} options
 * @return {Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]}
 */
const actionRow = (options) => [
  // @ts-ignore
  new Discord.ActionRowBuilder().addComponents(buttons1(options).filter(c => c !== undefined)),
  // @ts-ignore
  new Discord.ActionRowBuilder().addComponents(buttons2),
];

/**
 * Create or edit a permission overwrite
 * @param {Discord.BaseGuildVoiceChannel} channel
 * @param {string} id
 * @param {Discord.PermissionOverwriteOptions} perms
 */
function overwrite(channel, id, perms) {
  const old = channel.permissionOverwrites.cache.get(id);
  if (old) {
    return channel.permissionOverwrites.edit(id, Object.assign(old, perms));
  } else {
    return channel.permissionOverwrites.create(id, perms);
  }
}

/**
 * @param {Discord.Embed | Discord.EmbedBuilder} embed
 * @param {string} fieldName
 * @param {string} [newValue]
 */
function setField(embed, fieldName, newValue) {
  const e = new Discord.EmbedBuilder(embed.toJSON());
  const newFields = [];
  for (const field of (e.data.fields ?? [])) {
    if (field.name == fieldName) {
      if (!newValue) continue;
      newFields.push({ name: field.name, value: newValue, inline: field.inline });
    } else {
      newFields.push(field);
    }
  }
  return e.setFields(newFields);
}
/**
 * @typedef updates
 * @prop {boolean} locked
 * @prop {boolean} streamlocked
 * @prop {string[]} [allowedUsers]
 * @prop {string[]} [allowedSpeak]
 */

/**
 * @param {Discord.ButtonInteraction<"cached">} int
 * @param {Discord.BaseGuildVoiceChannel} channel
 * @param {string} [data]
*/

async function edit(int, channel, data) {
  const oldMsg = int.message;

  // Return an error message of some sort
  if (data) {
    await int.followUp({ content: data, ephemeral: true });
    return int.editReply({ content: oldMsg.content });
  }

  // Get status of vc
  const locked = isLocked(channel);
  const streamlocked = isStreamLocked(channel);
  const ignore = [int.user.id, int.client.user.id, int.guildId, u.sf.roles.icarus, u.sf.roles.muted, u.sf.roles.suspended, u.sf.roles.ducttape];
  const allowedUsers = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  const banned = channel.permissionOverwrites.cache.filter(p => p.deny.has("Connect") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  // Set new statuses
  let status = "";
  if (locked && streamlocked) status = "Channel Locked & Muted 🔒 🔇";
  else if (locked) status = "Channel Locked 🔒 🔊";
  else if (streamlocked) status = "Channel Muted 🔓 🔇";
  else status = "Channel Unlocked & Unmuted 🔓 🔊";
  const embed = u.embed(oldMsg.embeds[0]).setFields([
    { name: "Status", value: status, inline: true },
    { name: "Allowed Users", value: allowedUsers.length > 0 ? allowedUsers.join("\n") : locked ? "Nobody" : "Everyone!", inline: true },
    { name: "Can Speak", value: allowedSpeak.length > 0 ? allowedSpeak.join("\n") : streamlocked ? "Nobody" : "Everyone!", inline: true },
    { name: "Banned Users", value: banned.length > 0 ? banned.join("\n") : "Nobody", inline: true },
  ]);
  const components = actionRow({ locked, streamlocked, allowedSpeak, allowedUsers });
  int.editReply({ content: oldMsg.content, embeds: [embed], components });
}

/** @type {Discord.OverwriteResolvable[]} */
const channelPerms = [
  {
    id: u.sf.roles.muted,
    deny: ["ViewChannel", "Connect", "SendMessages", "Speak"]
  },
  {
    id: u.sf.roles.ducttape,
    deny: ["ViewChannel", "Connect", "Speak"]
  },
  {
    id: u.sf.roles.suspended,
    deny: ["ViewChannel", "Connect", "Speak"]
  }
];

/** @param {Discord.BaseGuildVoiceChannel} channel*/
function isLocked(channel) {
  return channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has("Connect") ?? false;
}
/** @param {Discord.BaseGuildVoiceChannel} channel*/
function isStreamLocked(channel) {
  return channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has("Speak") ?? false;
}

/** @type {voice} */
async function lock(int, channel) {
  // Allow connected users back in
  if (isLocked(channel)) return int.editReply("Your voice channel is already locked!");
  await channel.permissionOverwrites.set([...channel.permissionOverwrites.cache.values(),
    ...channel.members.map(/** @return {Discord.OverwriteResolvable} */m => {
      return { id: m.id, allow: ["Connect"] };
    })]);
  await overwrite(channel, int.guildId, { Connect: false });
  return edit(int, channel);
}
/** @type {voice} */
async function unlock(int, channel) {
  // Allow connected users back in
  if (!isLocked(channel)) return int.editReply("Your voice channel isn't locked!");
  const allowed = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect")).map(/** @return {Discord.OverwriteResolvable} */m => {
    return { id: m.id, allow: m.allow.remove("Connect") };
  });
  const ldsgPerm = channel.permissionOverwrites.cache.get(u.sf.ldsg);
  await channel.permissionOverwrites.set([...allowed, { id: u.sf.ldsg, deny: ldsgPerm?.deny.remove("Connect") }]);

  return edit(int, channel);
}


/** @type {voice} */
async function streamLock(int, channel) {
  if (isStreamLocked(channel)) return int.editReply("Your voice channel is already stream locked!");
  // let owner speak
  await overwrite(channel, int.member.id, { Speak: true });
  // prevent everyone else
  await overwrite(channel, int.guildId, { Speak: false });
  return edit(int, channel);
}
/** @type {voice} */
async function streamUnlock(int, channel) {
  if (!isStreamLocked(channel)) return int.editReply("Your voice channel isn't stream locked!");
  await overwrite(channel, int.guildId, { Speak: true });
  const allowed = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(/** @return {Discord.OverwriteResolvable} */ m => {
    return { id: m.id, allow: m.allow.remove("Speak") };
  });
  const ldsgPerm = channel.permissionOverwrites.cache.get(u.sf.ldsg);
  await channel.permissionOverwrites.set([...allowed, { id: u.sf.ldsg, deny: ldsgPerm?.deny.remove("Speak") }]);
  return edit(int, channel);
}
/** @type {voice} */
async function allowUser(int, channel) {
  if (!isLocked(channel)) return int.editReply("Your voice channel isn't locked!" + (isStreamLocked(channel) ? " Try the button for allowing to speak." : ""));
}
/** @type {voice} */
async function streamAllow(int, channel) {
  if (!isStreamLocked(channel)) return int.editReply("Your voice channel isn't stream locked!");
  await overwrite(channel, )
}
/** @type {voice} */
async function streamDeny(int, channel) {
  if (!isStreamLocked(channel)) return;
}
/** @type {voice} */
async function kickUser(int, channel) {
  return;
}
/** @type {voice} */
async function banUser(int, channel) {
  return;
}
/** @type {voice} */
async function setOwner(int, channel) {
  return;
}

const Module = new Augur.Module()
.addEvent("interactionCreate", async (int) => {
  if (!int.isButton() || !int.inCachedGuild() || !int.customId.startsWith("voice")) return;
  const channel = int.member.voice.channel;
  if (!channel) return int.reply({ content: "You need to be connected to a voice channel to use these buttons!", ephemeral: true });
  if (owners.get(channel.id) != int.user.id) return int.reply({ content: "You aren't the owner of this voice channel!", ephemeral: true });
  await int.deferUpdate();
  switch (int.customId) {
  case "voiceUnlock": return unlock(int, channel);
  case "voiceStreamUnlock": return streamUnlock(int, channel);
  case "voiceAllowUser": return allowUser(int, channel);
  case "voiceStreamAllow": return streamAllow(int, channel);
  case "voiceStreamDeny": return streamDeny(int, channel);

  // Only show sometimes
  case "voiceLock": return lock(int, channel);
  case "voiceStreamLock": return streamLock(int, channel);

  // Second row
  case "voiceKickUser": return kickUser(int, channel);
  case "voiceBanUser": return banUser(int, channel);
  // case "voiceUnbanUser": return unbanUser(int, channel);
  case "voiceSetOwner": return setOwner(int, channel);
  }
})
.addEvent("voiceStateUpdate", (oldState, newState) => {
  if (oldState.channel || !newState.channel || !newState.member) return;
  if (owners.get(newState.channel.id)) return;
  owners.set(newState.channel.id, newState.member.id);
  const embed = u.embed().setTitle("Voice Channel Control")
    .setDescription("This is the current state of your voice channel")
    .addFields([
      { name: "Status", value: "Unlocked", inline: true},
      { name: "Allowed Users", value: "Everyone!", inline: true},
      { name: "Can Speak", value: "Everyone!", inline: true},
    ]);
  newState.channel.send({ embeds: [embed], components: actionRow({ locked: false, streamlocked: false, allowedSpeak: [], allowedUsers: []})}) 
})
.setInit((o) => {
  if (o) owners = o;
})
.setUnload(() => owners);

module.exports = Module;