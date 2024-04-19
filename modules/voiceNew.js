// @ts-check
const Augur = require('augurbot-ts'),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  u = require('../utils/utils');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { nanoid } = require('nanoid');


/** @typedef {(int: Augur.GuildInteraction<"Button">, channel: Discord.BaseGuildVoiceChannel) => Promise<any>} voice */
/** @type {Discord.Collection<string, string>} */
let owners = new u.Collection();

/**
 * @param {updates} options
 * @return {Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]}
 */
const actionRow = (options) => {
  const styles = Discord.ButtonStyle;
  const buttons1 = [
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
  return [
    // @ts-ignore
    new Discord.ActionRowBuilder().addComponents(buttons1.filter(c => c !== undefined)),
    // @ts-ignore
    new Discord.ActionRowBuilder().addComponents(buttons2),
  ];
};

/**
 * @param {Discord.User} user
 * @param {Discord.BaseGuildVoiceChannel} channel
 * @param {Discord.Message} [oldMsg]
 */
function getComponents(user, channel, oldMsg) {
  // Get status of vc
  const locked = isLocked(channel);
  const streamlocked = isStreamLocked(channel);
  const ignore = [user.id, channel.client.user.id, channel.guildId, u.sf.roles.icarus, u.sf.roles.muted, u.sf.roles.suspended, u.sf.roles.ducttape];
  const allowedUsers = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  const banned = channel.permissionOverwrites.cache.filter(p => p.deny.has("Connect") && !ignore.includes(p.id)).map(p => `<@${p.id}>`);
  // Set new statuses
  let status = "";
  if (locked && streamlocked) status = "Channel Locked & Muted 🔒 🔇";
  else if (locked) status = "Channel Locked 🔒 🔊";
  else if (streamlocked) status = "Channel Muted 🔓 🔇";
  else status = "Channel Unlocked & Unmuted 🔓 🔊";
  const embed = u.embed(oldMsg?.embeds[0]).setFields([
    { name: "Status", value: status, inline: true },
    { name: "Allowed Users", value: allowedUsers.length > 0 ? allowedUsers.join("\n") : locked ? "Nobody" : "Everyone!", inline: true },
    { name: "Can Speak", value: allowedSpeak.length > 0 ? allowedSpeak.join("\n") : streamlocked ? "Nobody" : "Everyone!", inline: true },
    { name: "Banned Users", value: banned.length > 0 ? banned.join("\n") : "Nobody", inline: true },
  ]).setDescription(`Current Owner: <@${owners.get(channel.id)}>`);
  const components = actionRow({ locked, streamlocked, allowedSpeak, allowedUsers });
  return { embeds: [embed], components, content: null };
}

/**
 * @typedef updates
 * @prop {boolean} locked
 * @prop {boolean} streamlocked
 * @prop {string[]} [allowedUsers]
 * @prop {string[]} [allowedSpeak]
 */

/**
 * @param {Augur.GuildInteraction<"Button"|"SelectMenuUser">} int
 * @param {Discord.BaseGuildVoiceChannel} channel
 * @param {string} [content]
*/
async function edit(int, channel, content) {
  // Return an error message of some sort
  if (content) {
    return int.editReply({ content });
  }
  // Edit the card
  return int.editReply(getComponents(int.user, channel, int.message));
}

/** @param {Discord.BaseGuildVoiceChannel} channel*/
function isLocked(channel) {
  return channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has("Connect") ?? false;
}
/** @param {Discord.BaseGuildVoiceChannel} channel*/
function isStreamLocked(channel) {
  return channel.permissionOverwrites.cache.get(channel.guild.id)?.deny.has("Speak") ?? false;
}

/**
 * @param {Discord.BaseGuildVoiceChannel} channel
 * @param {{users: string[], allow?: Discord.PermissionsString[], deny?: Discord.PermissionsString[], remove?: Discord.PermissionsString[]}[]} perms
 * @returns {Discord.OverwriteData[]}
 */
function overwrite(channel, perms) {
  let currentOverwrites = channel.permissionOverwrites.cache.map(/** @return {{id: string, allow: Set<Discord.PermissionsString>, deny: Set<Discord.PermissionsString>}} */p => {
    return {
      id: p.id,
      allow: new Set(p.allow.toArray()),
      deny: new Set(p.deny.toArray())
    };
  });
  for (const perm of perms) {
    for (const user of perm.users) {
      if (user == channel.client.user.id || user == u.sf.roles.icarus) continue;
      let current = currentOverwrites.find(o => o.id == user);
      if (!current) {
        const i = currentOverwrites.push({ id: user, allow: new Set(), deny: new Set() });
        current = currentOverwrites[i - 1];
      }
      for (const allow of perm.allow ?? []) {
        current.deny.delete(allow);
        current.allow.add(allow);
      }
      for (const deny of perm.deny ?? []) {
        current.allow.delete(deny);
        current.deny.add(deny);
      }
      for (const remove of perm.remove ?? []) {
        current.allow.delete(remove);
        current.deny.delete(remove);
      }
      if (current.allow.size == 0 && current.deny.size == 0) currentOverwrites = currentOverwrites.filter(o => o.id != user);
    }
  }
  return currentOverwrites.map(o => {
    return { id: o.id, allow: [...o.allow], deny: [...o.deny] };
  });
}

/**
 * @param {Discord.ButtonInteraction<"cached">} int
 * @param {string} action
 * @param {number} [max]
 */
async function selectUsers(int, action, max) {
  const components = int.message.components;
  const id = nanoid(10);
  const menu = new Discord.UserSelectMenuBuilder()
  .setCustomId(id)
  .setMinValues(1)
  .setPlaceholder(`The user(s) to ${action}`);
  if (max) menu.setMaxValues(max);
  const select = new Discord.ActionRowBuilder().addComponents([menu]);
  // @ts-ignore
  const m = await int.editReply({ components: [...components, select] });

  const received = await m.awaitMessageComponent({ componentType: Discord.ComponentType.UserSelect, filter: (i) => i.customId == id, time: 5 * 60 * 1000 }).catch(() => {
    int.editReply({ components });
    return;
  });
  return received;
}

// Locking and unlocking of voice channel connecting
/** @type {voice} */
async function lock(int, channel) {
  // Allow connected users back in
  if (isLocked(channel)) return edit(int, channel, "Your voice channel is already locked!");
  const newPerms = overwrite(channel, [{ users: channel.members.map(m => m.id), allow: ["Connect", "SendMessages"] }, { users: [int.guildId], deny: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(int, channel);
}
/** @type {voice} */
async function unlock(int, channel) {
  if (!isLocked(channel)) return edit(int, channel, "Your voice channel isn't locked!");
  // remove perms for people who could join before
  const toRemove = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect")).map(p => p.id).concat([u.sf.ldsg]);
  const newPerms = overwrite(channel, [{ users: toRemove, remove: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(int, channel);
}
/** @type {voice} */
async function allowUser(int, channel) {
  if (!isLocked(channel)) return edit(int, channel, "Your voice channel isn't locked!" + (isStreamLocked(channel) ? " Try the button for allowing to speak." : ""));
  const selected = await selectUsers(int, "allow to join");
  if (!selected) return;
  await selected.deferUpdate();
  const allowedJoin = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect")).map(p => p.id);
  const people = selected.members.map(m => m.user.id).filter(m => !allowedJoin.includes(m));
  if (people.length == 0) return edit(selected, channel, "All of the people you selected are already able to join!");
  const newPerms = overwrite(channel, [{ users: people, allow: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  channel.send({ content: selected.members.map(m => m.toString()).join(' ') + " you can join now!", allowedMentions: { users: selected.members.map(m => m.id) } }).then(u.clean);
  return edit(selected, channel);
}

// Locking and unlocking of voice channel speaking
/** @type {voice} */
async function streamLock(int, channel) {
  if (isStreamLocked(channel)) return edit(int, channel, "Your voice channel is already stream locked!");
  // let only owner speak
  const newPerms = overwrite(channel, [{ users: [int.member.id], allow: ["Speak"] }, { users: [int.guildId], deny: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(int, channel);
}
/** @type {voice} */
async function streamUnlock(int, channel) {
  if (!isStreamLocked(channel)) return edit(int, channel, "Your voice channel isn't stream locked!");
  // remove perms for people who could speak before
  const toRemove = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id).concat([u.sf.ldsg]);
  const newPerms = overwrite(channel, [{ users: toRemove, remove: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(int, channel);
}
/** @type {voice} */
async function streamAllow(int, channel) {
  if (!isStreamLocked(channel)) return edit(int, channel, "Your voice channel isn't stream locked!" + (isLocked(channel) ? " Try the button for kicking users." : ""));
  const selected = await selectUsers(int, "allow to talk");
  if (!selected) return;
  await selected.deferUpdate();
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id);
  const people = selected.members.map(m => m.user.id).filter(m => !allowedSpeak.includes(m));
  if (people.length == 0) return edit(selected, channel, "Everybody you selected is already able to talk!");
  const newPerms = overwrite(channel, [{ users: people, allow: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(selected, channel);
}
/** @type {voice} */
async function streamDeny(int, channel) {
  if (!isStreamLocked(channel)) return edit(int, channel, "Your voice channel isn't stream locked!" + (isLocked(channel) ? " Try the button for kicking users." : ""));
  const selected = await selectUsers(int, "prevent from talking");
  if (!selected) return;
  await selected.deferUpdate();
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id);
  const people = selected.members.map(m => m.user.id).filter(m => allowedSpeak.includes(m));
  if (people.length == 0) return edit(selected, channel, "Nobody you selected is able to talk!");
  const newPerms = overwrite(channel, [{ users: people, remove: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return edit(selected, channel);
}


/** @type {voice} */
async function kickUser(int, channel) {
  const selected = await selectUsers(int, "kick from the channel");
  if (!selected) return;
  await selected.deferReply({ ephemeral: true });
  const members = channel.members.filter(m => selected.members.has(m.id));
  if (members.size == 0) return edit(selected, channel, "Nobody you selected is in your channel!");
  members.map(m => m.voice.disconnect());
  await selected.editReply("I disconnected those people!");
  return edit(int, channel);
}
/** @type {voice} */
async function banUser(int, channel) {
  const selected = await selectUsers(int, "ban from joining the channel");
  if (!selected) return;
  await selected.deferUpdate();
  const newPerms = overwrite(channel, [{ users: selected.members.map(m => m.id), deny: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  let i = 0;
  while (i < selected.members.size) {
    const member = selected.members.at(i);
    if (member?.voice.channelId == channel.id) await member.voice.disconnect();
    i++;
  }
  return edit(selected, channel);
}
/** @type {voice} */
async function unbanUser(int, channel) {
  const selected = await selectUsers(int, "unban from joining the channel");
  if (!selected) return;
  await selected.deferUpdate();
  const people = selected.members.map(m => m.id).filter(m => channel.permissionOverwrites.cache.get(m)?.deny.has("Connect"));
  if (people.length == 0) return edit(selected, channel, "None of the users you selected were banned!");
  const newPerms = overwrite(channel, [{ users: selected.members.map(m => m.id), remove: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  let i = 0;
  while (i < selected.members.size) {
    const member = selected.members.at(i);
    if (member?.voice.channelId == channel.id) await member.voice.disconnect();
    i++;
  }
  return edit(selected, channel);
}
/** @type {voice} */
async function setOwner(int, channel) {
  const selected = await selectUsers(int, "set as the new owner", 1);
  if (!selected) return;
  await selected.deferUpdate();
  const member = selected.members.first();
  if (!member) return u.errorHandler(new Error("Couldn't find selected member"), int);
  const unacceptable = member.id == int.member.id ? "You're already in control!" : member.user.bot ? `A bot can't own this channel!` : member.voice.channelId == channel.id ? "Someone who's not connected can't own the channel!" : null;
  if (unacceptable) return edit(selected, channel, unacceptable);
  if (isStreamLocked(channel)) await channel.permissionOverwrites.set(overwrite(channel, [{ users: [member.id], allow: ["Speak"] }, { users: [int.member.id], remove: ["Speak"] }]));
  return edit(selected, channel);
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
  case "voiceUnbanUser": return unbanUser(int, channel);
  case "voiceSetOwner": return setOwner(int, channel);
  }
})
.addEvent("voiceStateUpdate", (oldState, newState) => {
  if (oldState.guild.id != u.sf.ldsg) return;
  updateChannels(oldState, newState);
  if (oldState.channel || !newState.channel || !newState.member) return;
  if (owners.get(newState.channel.id)) return;
  owners.set(newState.channel.id, newState.member.id);
  const components = getComponents(newState.member.user, newState.channel);
  newState.channel.send({ embeds: components.embeds, components: components.components });
})
.setInit(async (o) => {
  if (o) owners = o;
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-ignore
    const channels = await doc.sheetsByTitle["Voice Channel Names"].getRows();
    channelNames = channels.map(x => x["Name"]);
  } catch (e) {
    u.errorHandler(e, "Voice Channel Init");
  }
})
.addEvent("ready", () => {
  updateChannels();
})
.setUnload(() => owners);

let processing = false;
/** @type {string[]} */
let channelNames = [];

/**
 * Update channel list
 * @param {Discord.VoiceState} [oldState]
 * @param {Discord.VoiceState} [newState]
 */
async function updateChannels(oldState, newState) {
  if (oldState && newState) {
    if (oldState.channel &&
      oldState.channel.members.size === 0 &&
      oldState.channel.parentId == u.sf.channels.communityVoice &&
      oldState.channel.id != u.sf.channels.voiceAFK
    ) {
      const id = oldState.channel.id;
      await oldState.channel.delete();
      owners.delete(id);
    }
  } else if (processing) {
    return;
  }
  processing = true;
  const communityVoice = Module.client.getCategoryChannel(u.sf.channels.communityVoice);
  if (!communityVoice) return processing = false;
  const channels = communityVoice.children.cache.filter(c => c.id != u.sf.channels.voiceAFK && c.isVoiceBased());
  const open = channels.filter(c => c.members.size == 0);
  const bitrates = [64, 96];
  if (!config.devMode) bitrates.push(128); // Only available in boosted server
  else bitrates.push(32); // makes up for it... kinda
  const used = channels.map(c => c.isVoiceBased() ? c.bitrate : 0);
  const bitrate = bitrates.find(c => !used.includes(c * 1000)) ?? u.rand(bitrates);
  if (open.size < 2 || channels.size < 3) {
    const unused = (/** @type {string[]} */ cn) => cn.filter(c => !channels.find(ch => ch.name.includes(c)));
    const name = u.rand(unused(channelNames)) ?? u.rand(unused(channelNames.map(c => c + " 2"))) ?? "Room Error";
    communityVoice.children.create({
      name: `${name} (${bitrate} kbps)`,
      type: Discord.ChannelType.GuildVoice,
      bitrate: bitrate * 1000,
    });
  }
  processing = false;
}

module.exports = Module;