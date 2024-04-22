// @ts-check
const Augur = require("augurbot-ts"),
  p = require("../utils/perms"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  Discord = require("discord.js");

const menuOptions = require("../data/modMenuOptions.json"),
  menuFlagOptions = require("../data/modMenuFlagOptions.json"),
  time = 5 * 60 * 1000,
  noTime = "I fell asleep waiting for your input...";

/**
 * @typedef {(int: Augur.GuildInteraction<"SelectMenuString">, target: Discord.GuildMember|Discord.User|null, apply?: boolean) => Promise<any>} user
 * @typedef {(int: Augur.GuildInteraction<"SelectMenuString">, target: Discord.Message<true>|null, apply?: boolean) => Promise<any>} message
 * @typedef {(int: Augur.GuildInteraction<"SelectMenuString">, message: Discord.Message<true>|null, user: Discord.GuildMember|Discord.User|null, apply?: boolean) => Promise<any>} both
 */

function usrErr(int) {
  const content = "I couldn't find the user! They may have left the server.";
  return int.replied ? edit(int, content) : int.update({ content, ephemeral: true });
}

function msgErr(int) {
  const content = "I couldn't find the message! It might have been deleted.";
  return int.replied ? edit(int, content) : int.update({ content, ephemeral: true });
}

/**
 * Handle replying to an interaction with components
 * @param {Discord.CommandInteraction|Discord.AnySelectMenuInteraction|Discord.ModalSubmitInteraction} int
 * @param {Discord.MessageEditOptions|string} payload
 */
function edit(int, payload) {
  const obj = { embeds: [], components: [], attachments: [], files: [], content: "" };
  if (typeof payload == 'string') {
    obj.content = payload;
    payload = obj;
  } else {
    payload = Object.assign(obj, payload);
  }
  return int.editReply(payload);
}

/** @param {Discord.StringSelectMenuInteraction} int*/
async function getReason(int, description, doPoints = false) {
  const components = [
    new Discord.TextInputBuilder()
      .setCustomId("reason")
      .setLabel(description)
      .setMinLength(1)
      .setPlaceholder(description)
      .setRequired(true)
      .setStyle(Discord.TextInputStyle.Paragraph)
  ];
  if (doPoints) {
    components.push(
      new Discord.TextInputBuilder()
        .setCustomId("points")
        .setLabel("How many points is this worth?")
        .setMinLength(1)
        .setMaxLength(2)
        .setPlaceholder("Any number between 0-99")
        .setRequired(true)
        .setStyle(Discord.TextInputStyle.Paragraph)
    );
  }
  const modal = new u.modal()
    .setTitle("Reason")
    .setCustomId("modMenuReason")
    .addComponents(
      // @ts-ignore component thingy
      new Discord.ActionRowBuilder()
        .setComponents(components)
    );
  await int.showModal(modal);
  const modalSubmit = await int.awaitModalSubmit({ time, dispose: true }).catch(() => {
    edit(int, noTime);
    return;
  });
  return modalSubmit;
}

/** @type {user} */
async function avatar(int, target) {
  if (!target) return usrErr(int);
  const embed = u.embed()
    .setImage(`attachment://avatar.png`)
    .setTitle(`${target.displayName}'s Avatar`);
  const image = u.attachment().setFile(target.displayAvatarURL({ extension: 'png' })).setName(`avatar.png`);
  return edit(int, { embeds: [embed], files: [image] });
}
/** @type {both} */
async function flagReason(int, msg, usr) {
  const id = u.customId();
  const reasons = new u.actionRow()
    .addComponents(
      new u.stringSelectMenu()
        .setCustomId(id)
        .setMaxValues(3)
        .setMinValues(1)
        .setPlaceholder("Select why you're flagging it")
        .setOptions(menuFlagOptions.map(f =>
          new Discord.StringSelectMenuOptionBuilder()
            .setDefault(false)
            .setDescription(f.description)
            .setEmoji(f.emoji)
            .setLabel(f.label)
            .setValue(f.value)
        ))
    );
  /** @param {Discord.StringSelectMenuInteraction} i*/
  const filter = (i) => i.customId == id && i.user.id == int.user.id;
  // @ts-ignore component thingy
  const responseMsg = await edit(int, { components: [reasons] });
  const response = await responseMsg.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time, dispose: true, filter }).catch(() => {
    edit(int, noTime);
    return;
  });
  if (response && response.inCachedGuild()) return flag(response, msg, usr);
  else return edit(int, noTime);
}
/** @type {both} */
async function flag(int, msg, usr) {
  if (!usr) return usrErr(int);
  await int.deferUpdate();
  const reason = int.values.map(v => menuFlagOptions.find(o => o.value == v)?.label).join(', ');
  if (msg) {
    // Don't let them know it was already flagged, but also don't create a duplicate
    const existing = await u.db.infraction.getByMsg(msg.id);
    if (existing) return edit(int, "Your report has been created! Moderators may reach out if they need more details.");
  }
  const madeFlag = await c.createFlag({ msg: msg ?? undefined, member: usr, pingMods: false, snitch: int.member.toString(), flagReason: reason }, int);
  if (madeFlag) return edit(int, "Your report has been created! Moderators may reach out if they need more details.");
  else return edit(int, "Sorry, I ran into an error while creating your report. Please let the moderators know about the issue.");
}
/** @type {message} */
async function pin(int, msg) {
  if (!msg) return msgErr(int);
  if (!msg.pinnable) return edit(int, "I can't pin that message! I might not have permissions.");
  if (msg.pinned) return edit(int, "That message is already pinned!");
  if (msg.channel.permissionsFor(int.member).has("ManageMessages")) {
    // pin the message if they're able to do that
    const messages = await msg.channel.messages.fetchPinned().catch(u.noop);
    if ((messages?.size ?? 0) > 49) return edit(int, "I can't pin that message as this channel has reached it's pin limit of 50.");
    await msg.pin().catch((e) => u.errorHandler(e, int));
    return edit(int, "Message pinned!");
  } else {
    const embed = u.embed({ author: int.member })
      .setTimestamp()
      .setDescription(msg.cleanContent)
      .addFields(
        { name: "Pin Requested By", value: int.member.toString() },
        { name: "Channel", value: msg.channel.toString() },
        { name: "Jump to Post", value: `[Original Message](${msg.url})` }
      );
    if (msg.attachments.size > 0) embed.setImage(msg.attachments.first()?.url ?? null);
    int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
    return edit(int, "Pin request submitted!");
  }
}
/** @type {user} */
async function userSummary(int, usr) {
  if (!usr) return usrErr(int);

  const e = await c.getSummaryEmbed(usr, 28);
  return edit(int, { embeds: [e] });
}
/** @type {user} */
async function noteUser(int, usr) {
  if (!usr) return usrErr(int);
  const modal = new u.modal()
    .setTitle("Note")
    .setCustomId("noteModal")
    .addComponents(
      // @ts-ignore component thingy
      new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.TextInputBuilder()
            .setCustomId("note")
            .setLabel("The note to record")
            .setMinLength(1)
            .setPlaceholder("The note to record")
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Paragraph)
        )
    );
  await int.showModal(modal);
  const modalSubmit = await int.awaitModalSubmit({ time, dispose: true }).catch(() => {
    edit(int, noTime);
  });
  if (modalSubmit) {
    await modalSubmit.deferUpdate();
    const noted = await c.note(modalSubmit, usr, modalSubmit.fields.getTextInputValue("note"));
    return edit(modalSubmit, noted);
  }
}
/** @type {user} */
async function renameUser(int, usr) {
  console.log('running?');
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const modal = new u.modal()
    .setTitle("Rename User")
    .setCustomId("modMenuRename")
    .addComponents(
      // @ts-ignore component thingy
      new Discord.ActionRowBuilder()
        .setComponents(
          new Discord.TextInputBuilder()
            .setCustomId("name")
            .setLabel("Name (reset if left blank)")
            .setMaxLength(20)
            .setPlaceholder("Their new name")
            .setRequired(false)
            .setStyle(Discord.TextInputStyle.Short)
        )
    );
  await int.showModal(modal);
  const modalSubmit = await int.awaitModalSubmit({ time, dispose: true });
  if (modalSubmit) {
    await modalSubmit.deferUpdate();
    const name = modalSubmit.fields.getTextInputValue("name") ?? "";
    const named = await c.rename(modalSubmit, usr, name, name == "");
    return edit(modalSubmit, named);
  } else {
    return int.update(noTime);
  }
}
/** @type {user} */
async function trustUser(int, usr, apply = true) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const trust = await c.trust(int, usr, apply);
  return edit(int, trust);
}
/** @type {user} */
async function trustPlusUser(int, usr, apply = true) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const trust = await c.trustPlus(int, usr, apply);
  return edit(int, trust);
}
/** @type {user} */
async function watchUser(int, usr, apply = true) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const watching = await c.watch(int, usr, apply);
  return edit(int, watching);
}
/** @type {user} */
async function warnUser(int, usr) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const reason = await getReason(int, "What's the warning for?", true);
  if (reason) {
    await reason.deferUpdate();
    const r = reason.fields.getTextInputValue("reason");
    const v = reason.fields.getTextInputValue("points");
    const warn = await c.warn(int, r, parseInt(v) ?? 1, usr);
    return edit(reason, warn);
  } else {
    return int.update(noTime);
  }
}
/** @type {user} */
async function muteUser(int, usr, apply = true) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  let reason = undefined;
  if (apply) {
    const gotR = await getReason(int, "Why are they being muted?");
    if (gotR) {
      reason = gotR.fields.getTextInputValue("reason");
      await gotR.deferUpdate();
    } else {
      return;
    }
  }
  const mute = await c.mute(int, usr, reason, apply);
  return edit(int, mute);
}
/** @type {user} */
async function timeoutUser(int, usr) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const reason = await getReason(int, "What's the timeout for?");
  if (reason) {
    await reason.deferUpdate();
    const r = reason.fields.getTextInputValue("reason");
    const timeout = await c.timeout(int, usr, 10, r);
    return edit(reason, timeout);
  } else {
    return int.update(noTime);
  }
}
/** @type {user} */
async function kickUser(int, usr) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const reason = await getReason(int, "What's the kick for?");
  if (reason) {
    await reason.deferUpdate();
    const r = reason.fields.getTextInputValue("reason");
    const timeout = await c.kick(int, usr, r);
    return edit(reason, timeout);
  } else {
    return int.update(noTime);
  }
}
/** @type {user} */
async function banUser(int, usr) {
  if (!usr || !(usr instanceof Discord.GuildMember)) return usrErr(int);
  const reason = await getReason(int, "What's the ban for?");
  if (reason) {
    await reason.deferUpdate();
    const r = reason.fields.getTextInputValue("reason");
    const timeout = await c.ban(int, usr, r);
    return edit(reason, timeout);
  } else {
    return int.update(noTime);
  }
}
/** @type {message} */
async function warnMessage(int, msg) {
  if (!msg) return msgErr(int);
  const usr = msg.member;
  if (!usr) return usrErr(int);
  const reason = await getReason(int, "What's the warning for?", true);
  if (reason) {
    await reason.deferUpdate();
    const r = reason.fields.getTextInputValue("reason");
    const v = reason.fields.getTextInputValue("points");
    const warn = await c.warn(int, r, parseInt(v) ?? 1, usr, msg);
    return edit(reason, warn);
  } else {
    return int.update(noTime);
  }
}
/** @type {message} */
async function purgeChannel(int, msg) {
  if (!msg) return msgErr(int);
  const channel = int.channel;
  if (!channel) return edit(int, "Well that's awkward, I can't access the channel you're in!");

  u.clean(msg, 0);
  let toDelete = await channel.messages.fetch({ after: msg.id });

  let total = 1;
  let b = false;
  while ((toDelete?.size || 0) > 0 && total < 75 && !b) {
    const deleted = await channel.bulkDelete(toDelete, true);
    if (toDelete.size != deleted.size) {
      const diff = toDelete.difference(deleted);
      for (const [, message] of diff) {
        try {
          await message?.delete().catch(u.noop);
          total++;
        } catch (error) {
          b = true;
          break;
        }
      }
    }
    toDelete = await int.channel.messages.fetch({ after: msg.id });
  }
  let content = `I deleted ${total} messages!`;
  if (total >= 74) content += " I could have deleted more, but that gets dangerous. Feel free to run the command again if you really need to.";
  edit(int, content);
}
/** @type {message} */
async function spamCleanup(int, msg) {
  if (!msg) return msgErr(int);
  return edit(int, "I still have to implement this but I'm too lazy right now");
}
/** @type {message} */
async function announceMessage(int, msg) {
  if (!msg) return msgErr(int);
  const embed = u.embed({ author: msg.member })
    .setTimestamp(msg.createdAt)
    .setDescription(msg.content);
  if (msg.attachments.size > 0) {
    embed.setImage(msg.attachments.first()?.proxyURL ?? null);
  }
  await int.client.getTextChannel(u.sf.channels.announcements)?.send({ embeds: [embed] });
  return edit(int, "Message announced!");
}
/**
 * @param {Augur.GuildInteraction<"SelectMenuString">} submitted
 * @param {Augur.GuildInteraction<"ContextBase">} oldInt
*/
async function handleModMenu(submitted, oldInt) {
  const components = permComponents(oldInt);
  const component = components.find(cmp => cmp.value == submitted.values[0]);
  if (!component) return submitted.update({ content: "I couldn't find that command!", components: [] });
  const message = oldInt.isMessageContextMenuCommand() ? oldInt.targetMessage : null;
  const user = oldInt.isUserContextMenuCommand() ? oldInt.targetMember ?? oldInt.targetUser : message?.member ?? null;
  if (!user && !message) return u.errorHandler(null, "No user or message on modMenu");
  console.log(submitted.values[0]);
  // These commands require additional input and can't be defered
  switch (submitted.values[0]) {
  case "noteUser": return noteUser(submitted, user);
  case "renameUser": return renameUser(submitted, user);
  case "warnUser": return warnUser(submitted, user);
  case "muteUser": return muteUser(submitted, user, true);
  case "timeoutUser": return timeoutUser(submitted, user);
  case "kickUser": return kickUser(submitted, user);
  case "banUser": return banUser(submitted, user);
  case "warnMessage": return warnMessage(submitted, message);
  }
  // These ones don't require additional inputs,
  await submitted.deferUpdate();
  switch (submitted.values[0]) {
  case "purgeChannel": return purgeChannel(submitted, message);
  case "spamCleanup": return spamCleanup(submitted, message);
  case "announceMessage": return announceMessage(submitted, message);
  case "userAvatar": return avatar(submitted, user);
  case "flag": return flagReason(submitted, message, user);
  case "pinMessage": return pin(submitted, message);
  case "userSummary": return userSummary(submitted, user);
  case "trustUser": return trustUser(submitted, user, true);
  case "untrustUser": return trustUser(submitted, user, false);
  case "trustPlusUser": return trustPlusUser(submitted, user, true);
  case "untrustPlusUser": return trustPlusUser(submitted, user, false);
  case "watchUser": return watchUser(submitted, user, true);
  case "unwatchUser": return watchUser(submitted, user, false);
  case "unmuteUser": return muteUser(submitted, user, false);
  default: return edit(submitted, "I'm not sure what command you used, but it's not any of the ones I know...");
  }
}

/** @param {Augur.GuildInteraction<"ContextBase">} int */
function permComponents(int, filterType = true) {
  let components = menuOptions.everyone;
  if (p.calc(int.member, ['mod'])) components = components.concat(menuOptions.mod);
  if (p.calc(int.member, ['mgmt'])) components = components.concat(menuOptions.mgmt);
  if (!filterType) return components;
  return components.filter(cmp => (
    cmp.context == 'msg' && int.isMessageContextMenuCommand() ||
    cmp.context == 'usr' && int.isUserContextMenuCommand() ||
    cmp.context == 'any'
  ));
}

/** @param {Augur.GuildInteraction<"ContextBase">} int */
async function sendModMenu(int) {
  await int.deferReply({ ephemeral: true });
  const id = u.customId();
  const components = permComponents(int);
  const actionRow = new u.actionRow()
    .setComponents(
      new u.stringSelectMenu()
        .setCustomId(id)
        .setMaxValues(1)
        .setMinValues(1)
        .setOptions(components.map(cmp =>
          new Discord.StringSelectMenuOptionBuilder()
            .setDefault(false)
            .setDescription(cmp.description)
            .setEmoji(cmp.emoji)
            .setLabel(cmp.label)
            .setValue(cmp.value)
        ))
    );

  /** @param {Discord.StringSelectMenuInteraction} i*/
  const filter = (i) => i.customId == id && i.user.id == int.user.id;
  // @ts-ignore component thingy
  const msg = await edit(int, { components: [actionRow] });
  const component = await msg.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time, dispose: true, filter }).catch(() => {
    edit(int, noTime);
  });
  if (component && component.inCachedGuild()) handleModMenu(component, int);
}
const Module = new Augur.Module()
  .addInteraction({
    id: u.sf.commands.messageMod,
    name: "msgModMenu",
    type: "ContextMessage",
    onlyGuild: true,
    process: sendModMenu
  })
  .addInteraction({
    id: u.sf.commands.userMod,
    name: "usrModMenu",
    type: "ContextUser",
    onlyGuild: true,
    process: sendModMenu
  });

module.exports = Module;