// @ts-check
const Augur = require('augurbot-ts'),
  Discord = require('discord.js'),
  config = require('../config/config.json'),
  perm = require("../utils/perms"),
  u = require('../utils/utils');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { nanoid } = require('nanoid');


/** @typedef {(int: Augur.GuildInteraction<"Button"|"CommandSlash">, channel: Discord.BaseGuildVoiceChannel, trying?: boolean) => Promise<{msg: string, int: Augur.GuildInteraction<"CommandSlash"|"Button"|"SelectMenuUser">}|Discord.Interaction<"cached">|false>} voice */

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
  ];
  return [
    // @ts-ignore
    new Discord.ActionRowBuilder().addComponents(buttons1.filter(c => c !== undefined)),
    // @ts-ignore
    new Discord.ActionRowBuilder().addComponents(buttons2),
  ];
};

const noUser = "I couldn't find that person!";

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
  ]).setDescription(`Controls for ${channel}`)
  .setTitle("VC Control Panel");
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
    return int.editReply({ ...getComponents(int.user, channel, int.message), content });
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
  for (const permission of perms) {
    for (const user of permission.users) {
      if (user == channel.client.user.id || user == u.sf.roles.icarus) continue;
      let current = currentOverwrites.find(o => o.id == user);
      if (!current) {
        const i = currentOverwrites.push({ id: user, allow: new Set(), deny: new Set() });
        current = currentOverwrites[i - 1];
      }
      for (const allow of permission.allow ?? []) {
        current.deny.delete(allow);
        current.allow.add(allow);
      }
      for (const deny of permission.deny ?? []) {
        current.allow.delete(deny);
        current.deny.add(deny);
      }
      for (const remove of permission.remove ?? []) {
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
 */
async function selectUsers(int, action) {
  const components = int.message.components;
  const id = nanoid(10);
  const menu = new Discord.UserSelectMenuBuilder()
  .setCustomId(id)
  .setMinValues(1)
  .setMaxValues(1)
  .setPlaceholder(`The user to ${action}`);
  const select = new Discord.ActionRowBuilder().addComponents([menu]);
  // @ts-ignore
  const m = await int.editReply({ components: [...components, select] });

  const received = await m.awaitMessageComponent({ componentType: Discord.ComponentType.UserSelect, filter: (i) => i.customId == id, time: 5 * 60 * 1000 }).catch(() => {
    int.editReply({ components });
    return;
  });
  return received;
}

/** @param {Augur.GuildInteraction<"Button"|"CommandSlash">} int*/
async function getUser(int, string) {
  if (int instanceof Discord.ButtonInteraction) {
    const selected = await selectUsers(int, string);
    if (!selected) return null;
    await selected.deferUpdate();
    const member = selected.members.first();
    if (!member) return { member: null, newInt: selected };
    return { member, newInt: selected };
  } else {
    const member = int.options.getMember("user");
    if (!member) return { member: null, newInt: int };
    return { member, newInt: int };
  }
}

// Locking and unlocking of voice channel connecting
/** @type {voice} */
async function lock(int, channel, trying = false) {
  // Allow connected users back in
  if (isLocked(channel)) {
    if (!trying && int instanceof Discord.ButtonInteraction) {
      const tryUnlock = await unlock(int, channel, true);
      if (tryUnlock instanceof Discord.ButtonInteraction) return int;
    }
    return { msg: "Your voice channel is already locked!", int };
  }
  const newPerms = overwrite(channel, [{ users: channel.members.map(m => m.id), allow: ["Connect", "SendMessages"] }, { users: [int.guildId], deny: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return int;
}

/** @type {voice} */
async function unlock(int, channel, trying = false) {
  if (!isLocked(channel)) {
    if (!trying && int instanceof Discord.ButtonInteraction) {
      const tryLock = await lock(int, channel, true);
      if (tryLock instanceof Discord.ButtonInteraction) return int;
    }
    return { msg: "Your voice channel isn't locked!", int };
  }
  // remove perms for people who could join before
  const toRemove = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect")).map(p => p.id).concat([u.sf.ldsg]);
  const newPerms = overwrite(channel, [{ users: toRemove, remove: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return int;
}

/** @type {voice} */
async function allowUser(int, channel) {
  if (!isLocked(channel)) return { msg: "Your voice channel isn't locked!" + (isStreamLocked(channel) ? " Try the button for allowing to speak." : ""), int };
  // get user (either selected or a provided option)
  const user = await getUser(int, "allow to join");
  if (user == null) return false;

  const { member, newInt } = user;
  if (!member) return { msg: noUser, int: newInt };
  const allowedJoin = channel.permissionOverwrites.cache.filter(p => p.allow.has("Connect")).map(p => p.id);
  if (allowedJoin.includes(member.id)) return { msg: `${member} can already join!`, int: newInt };
  // create overwrite
  const newPerms = overwrite(channel, [{ users: [member.id], allow: ["Connect", "SendMessages"] }]);
  await channel.permissionOverwrites.set(newPerms);
  // notify user
  channel.send({ content: `${member}, you can join now!`, allowedMentions: { parse: ["users"] } }).then(u.clean);
  return newInt;
}

// Locking and unlocking of voice channel speaking
/** @type {voice} */
async function streamLock(int, channel, trying = false) {
  if (isStreamLocked(channel)) {
    if (!trying && int instanceof Discord.ButtonInteraction) {
      const tryUnlock = await streamUnlock(int, channel, true);
      if (tryUnlock instanceof Discord.ButtonInteraction) return int;
    }
    return { msg: "Your voice channel is already stream locked!", int };
  }
  // let only owner speak
  const newPerms = overwrite(channel, [{ users: [int.member.id], allow: ["Speak"] }, { users: [int.guildId], deny: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return int;
}
/** @type {voice} */
async function streamUnlock(int, channel, trying = false) {
  if (!isStreamLocked(channel)) {
    if (!trying && int instanceof Discord.ButtonInteraction) {
      const tryLock = await streamLock(int, channel, true);
      if (tryLock instanceof Discord.ButtonInteraction) return int;
    }
    return { msg: "Your voice channel isn't stream locked!", int };
  }
  // remove perms for people who could speak before
  const toRemove = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id).concat([u.sf.ldsg]);
  const newPerms = overwrite(channel, [{ users: toRemove, remove: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return int;
}
/** @type {voice} */
async function streamAllow(int, channel) {
  if (!isStreamLocked(channel)) return { msg: "Your voice channel isn't stream locked!", int };
  const user = await getUser(int, "allow to talk");
  if (user == null) return false;

  const { member, newInt } = user;
  if (!member) return { msg: noUser, int: newInt };
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id);
  const people = [member.id].filter(m => !allowedSpeak.includes(m));
  if (people.length == 0) return { msg: `${member} is already able to talk!`, int: newInt };

  const newPerms = overwrite(channel, [{ users: people, allow: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return newInt;
}
/** @type {voice} */
async function streamDeny(int, channel) {
  if (!isStreamLocked(channel)) return { msg: "Your voice channel isn't stream locked!" + (isLocked(channel) ? " Try the button for kicking users." : ""), int };
  const user = await getUser(int, "prevent from talking");
  if (user == null) return false;

  const { member, newInt } = user;
  if (!member) return { msg: noUser, int: newInt };
  const allowedSpeak = channel.permissionOverwrites.cache.filter(p => p.allow.has("Speak")).map(p => p.id);
  if (!allowedSpeak.includes(member.id)) return { msg: `${member} wasn't able to speak in the first place!`, int: newInt };

  const newPerms = overwrite(channel, [{ users: [member.id], remove: ["Speak"] }]);
  await channel.permissionOverwrites.set(newPerms);
  return newInt;
}

/** @type {voice} */
async function kickUser(int, channel) {
  const user = await getUser(int, "kick from the channel");
  if (user == null) return false;

  const { member, newInt } = user;
  if (!member) return { msg: noUser, int: newInt };
  if (!channel.members.has(member.id)) return { msg: `${member} isn't in your channel!`, int: newInt };
  await member.voice.disconnect();
  return newInt;
}

const Module = new Augur.Module()
.addEvent("interactionCreate", async (int) => {
  if (!int.isButton() || !int.inCachedGuild() || !int.customId.startsWith("voice")) return false;
  const channel = int.member.voice.channel;
  if (!channel || channel.id != int.message.channel.id) return int.reply({ content: "You need to be connected to that voice channel to use these buttons!", ephemeral: true });
  await int.deferUpdate();
  let result;
  switch (int.customId) {
  case "voiceUnlock": result = await unlock(int, channel); break;
  case "voiceStreamUnlock": result = await streamUnlock(int, channel); break;
  case "voiceAllowUser": result = await allowUser(int, channel); break;
  case "voiceStreamAllow": result = await streamAllow(int, channel); break;
  case "voiceStreamDeny": result = await streamDeny(int, channel); break;

  // Only showed sometimes
  case "voiceLock": result = await lock(int, channel); break;
  case "voiceStreamLock": result = await streamLock(int, channel); break;

  // Second row
  case "voiceKickUser": result = await kickUser(int, channel); break;
  default: return;
  }
  if (result == false) return;
  else if (result instanceof Discord.ButtonInteraction || result instanceof Discord.UserSelectMenuInteraction) edit(result, channel);
  else if ("int" in result && !(result.int instanceof Discord.ChatInputCommandInteraction)) edit(result.int, channel, result.msg);
  else console.log(result);

})
.addInteraction({ name: "slashVoice",
  id: u.sf.commands.slashVoice,
  onlyGuild: true,
  permissions: (int) => perm.calc(int.member, ["notMuted"]),
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    const channel = int.member.voice.channel;
    await int.deferReply({ ephemeral: true });
    // handled seperately cuz they might not be able to join
    if (subcommand == "refresh") {
      updateChannels(undefined, undefined, true);
      return int.editReply("I've added empty voice channels if there weren't before.");
    }
    if (!channel) return int.editReply("You need to be in a voice channel to run these commands!");
    let result;
    const user = int.options.getUser("user");
    switch (subcommand) {
    case "lock": result = await (user ? !isLocked(channel) ? lock(int, channel).then(() => allowUser(int, channel)) : allowUser(int, channel) : lock(int, channel)); break;
    case "unlock": result = await unlock(int, channel); break;
    case "streamlock": result = await (user ? !isStreamLocked(channel) ? streamLock(int, channel).then(() => streamAllow(int, channel)) : streamAllow(int, channel) : streamLock(int, channel)); break;
    case "streamunlock": result = await streamUnlock(int, channel); break;
    case "kick": result = await kickUser(int, channel); break;
    default: return int.editReply("You did something I don't know how to process!");
    }
    if (result == false) return;
    else if (result instanceof Discord.BaseInteraction) return int.editReply(`${subcommand} successful!`);
    else int.editReply(result?.msg ?? "I ran into an error.");
  }
})
.addEvent("voiceStateUpdate", (oldState, newState) => {
  if (oldState.guild.id != u.sf.ldsg) return;
  updateChannels(oldState, newState);
  if (oldState.channel || !newState.channel || !newState.member) return;
  const components = getComponents(newState.member.user, newState.channel);
  newState.channel.send({ embeds: components.embeds, components: components.components });
})
.setInit(async () => {
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
});

let processing = false;
/** @type {string[]} */
let channelNames = [];

/**
 * Update channel list
 * @param {Discord.VoiceState} [oldState]
 * @param {Discord.VoiceState} [newState]
 */
async function updateChannels(oldState, newState, bypass = false) {
  if (oldState && newState) {
    // delete channel or set new owner
    const channel = oldState.channel;
    if (channel && channel.parentId == u.sf.channels.voiceCategory && channel.id != u.sf.channels.voiceAFK) {
      // delete channel
      if (oldState.channel.members.size === 0) await channel.delete();
    } else if (processing) {
      return;
    }
  } else if (processing && !bypass) {
    return;
  }
  processing = true;
  const communityVoice = Module.client.getCategoryChannel(u.sf.channels.voiceCategory);
  if (!communityVoice) return processing = false;
  const channels = communityVoice.children.cache.filter(c => c.id != u.sf.channels.voiceAFK && c.isVoiceBased());
  const open = channels.filter(c => c.members.size == 0);
  const bitrates = [64, 96];
  if (!config.devMode) bitrates.push(128); // Only available in boosted server
  else bitrates.push(32); // makes up for it... kinda
  const used = channels.map(c => c.isVoiceBased() ? c.bitrate : 0);
  const bitrate = bitrates.find(c => !used.includes(c * 1000)) ?? u.rand(bitrates);
  if (open.size < 2 || channels.size < 3) {
    const name = u.rand(channelNames.filter(cn => !channels.find(ch => ch.name.includes(cn)))) ?? "Room Error";
    communityVoice.children.create({
      name: `${name} (${bitrate} kbps)`,
      type: Discord.ChannelType.GuildVoice,
      bitrate: bitrate * 1000,
    });
  }
  processing = false;
}

module.exports = Module;