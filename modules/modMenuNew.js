// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  Discord = require("discord.js");

const menuOptions = require("../data/modMenuOptions.json"),
  menuFlagOptions = require("../data/modMenuFlagOptions.json"),
  time = 5 * 60 * 1000,
  noTime = "I fell asleep waiting for your input...";

/**
 * @typedef {Augur.GuildInteraction<"SelectMenuString">} MenuSelection
 * @typedef {(int: MenuSelection, target: Discord.GuildMember|Discord.User|null, apply?: boolean) => Promise<any>} user
 * @typedef {(int: MenuSelection, target: Discord.GuildMember, apply?: boolean) => Promise<any>} member
 * @typedef {(int: MenuSelection, target: Discord.Message<true>|null, apply?: boolean) => Promise<any>} message
 * @typedef {(int: MenuSelection, message: Parameters<message>[1], user: Parameters<user>[1], apply?: boolean) => Promise<any>} both
 */

/** @param {Discord.AnySelectMenuInteraction} int */
function usrErr(int) {
  const content = "I couldn't find the user! They may have left the server.";
  return int.replied ? edit(int, content) : int.update({ content, components: [], embeds: [] });
}

/** @param {Discord.AnySelectMenuInteraction} int */
function msgErr(int) {
  const content = "I couldn't find the message! It might have been deleted.";
  return int.replied ? edit(int, content) : int.update({ content });
}

/**
 * Handle replying to an interaction with components
 * @param {Discord.CommandInteraction|Discord.AnySelectMenuInteraction|Discord.ModalSubmitInteraction|Discord.ButtonInteraction} int
 * @param {Discord.MessageEditOptions|string} payload
 */
function edit(int, payload) {
  const obj = { embeds: [], components: [], attachments: [], files: [], content: "" };
  if (typeof payload === 'string') {
    obj.content = payload;
    payload = obj;
  } else {
    payload = Object.assign(obj, payload);
  }
  return int.editReply(payload);
}

/**
 * @param {Discord.StringSelectMenuInteraction<"cached">} int
 * @param {string} description
*/
async function getReason(int, description) {
  const components = [
    new u.TextInput()
      .setCustomId("reason")
      .setLabel(description)
      .setMinLength(1)
      .setPlaceholder(description)
      .setRequired(true)
      .setStyle(Discord.TextInputStyle.Paragraph)
  ];
  const modal = new u.Modal()
    .setTitle("Reason")
    .setCustomId("modMenuReason")
    .addComponents(
      u.ModalActionRow()
        .setComponents(components)
    );
  await int.showModal(modal);
  const modalSubmit = await int.awaitModalSubmit({ time, dispose: true }).catch(() => {
    edit(int, noTime);
    return;
  });

  if (modalSubmit) {
    await modalSubmit.deferUpdate();
    const reason = modalSubmit.fields.getTextInputValue("reason");

    return { modalSubmit, reason };
  }

  await int.update(noTime);
}

/** @type {user} */
async function avatar(int, target) {
  if (!target) return usrErr(int);
  const embed = u.embed()
    .setImage(`attachment://avatar.png`)
    .setTitle(`${target.displayName}'s Avatar`);
  const image = new u.Attachment(target.displayAvatarURL({ extension: 'png' }), { name: 'avatar.png' });
  return edit(int, { embeds: [embed], files: [image] });
}
/** @type {both} */
async function flagReason(int, msg, usr) {
  const reasons = u.MessageActionRow()
    .addComponents(
      new u.SelectMenu.String()
        .setCustomId("flagReason")
        .setMaxValues(2)
        .setMinValues(1)
        .setPlaceholder("Select why you're flagging it")
        .setOptions(menuFlagOptions.map(f =>
          new u.SelectMenu.StringOption()
            .setDefault(false)
            .setDescription(f.description)
            .setEmoji(f.emoji)
            .setLabel(f.label)
            .setValue(f.value)
        ))
    );

  const responseMsg = await edit(int, { components: [reasons] });
  const response = await responseMsg.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time, dispose: true }).catch(() => {
    edit(int, noTime);
    return;
  });
  if (response && response.inCachedGuild()) return flag(response, msg, usr);
  return edit(int, noTime);
}
/**
 * @type {both}
 * @param {Discord.GuildMember} usr
 */
async function flag(int, msg, usr) {
  if (!usr) return usrErr(int);
  await int.deferUpdate();
  const reason = int.values.map(v => menuFlagOptions.find(o => o.value === v)?.label).join(', ');
  if (reason.includes("Mod Abuse") && !u.perms.calc(usr, ["mod", "mcMod", "mgr"])) return edit(int, "Only Moderators can be flagged for mod abuse.");
  if (msg) {
    // Don't let them know it was already flagged, but also don't create a duplicate
    const existing = await u.db.infraction.getByMsg(msg.id);
    if (existing) return edit(int, "Your report has been created! Moderators may reach out if they need more details.");
  }
  const madeFlag = await c.createFlag({ msg: msg ?? undefined, member: usr, pingMods: false, snitch: int.member, flagReason: reason }, int);
  if (madeFlag) return edit(int, "Your report has been created! Moderators may reach out if they need more details.");
  return edit(int, "Sorry, I ran into an error while creating your report. Please let the moderators know about the issue.");
}

/** @type {message} */
async function pin(int, msg) {
  if (!msg) return msgErr(int);
  if (msg.pinned) return edit(int, "That message is already pinned!");
  if (!msg.pinnable) return edit(int, "I can't pin that message! I might not have permissions.");
  if (u.perms.calc(int.member, ["team", "mod", "mgr"])) {
    // pin the message if they're able to do that
    const messages = await msg.channel.messages.fetchPinned().catch(u.noop);
    if ((messages?.size ?? 0) > 49) return edit(int, "I can't pin that message as this channel has reached it's pin limit of 50.");
    await msg.pin().catch((e) => u.errorHandler(e, int));
    return edit(int, "Message pinned!");
  }
  if (msg.author.id === int.user.id) return edit(int, "You can't request your own message to be pinned!");
  const embed = u.embed({ author: int.member })
      .setTimestamp()
      .setDescription(msg.cleanContent || null)
      .addFields(
        { name: "Pin Requested By", value: int.member.toString() },
        { name: "Post", value: msg.url }
      );
  if (msg.attachments.size > 0) embed.setImage(msg.attachments.first()?.url ?? null);
  int.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });
  return edit(int, "Pin request submitted!");

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
  const modal = new u.Modal()
    .setTitle("Note")
    .setCustomId("noteModal")
    .addComponents(
      u.ModalActionRow()
        .addComponents(
          new u.TextInput()
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

/** @type {member} */
async function renameUser(int, usr) {
  const modal = new u.Modal()
    .setTitle("Rename User")
    .setCustomId("modMenuRename")
    .addComponents(
      u.ModalActionRow()
        .setComponents(
          new u.TextInput()
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
    const named = await c.rename(modalSubmit, usr, name, name === "");
    return edit(modalSubmit, named);
  }
  return int.update(noTime);

}


/**
 * @param {Parameters<user>[0]} interaction
 * @param {Parameters<user>[1]} user
 * @returns {user is Discord.GuildMember}
 */
function memberTest(interaction, user) {
  const isMember = Boolean(user && user instanceof Discord.GuildMember);
  if (!isMember) usrErr(interaction);

  return isMember;
}

/** @type {member} */
async function trustUser(int, usr, apply = true) {
  const trust = await c.trust(int, usr, apply);
  return edit(int, trust);
}

/** @type {member} */
async function trustPlusUser(int, usr, apply = true) {
  const trust = await c.trustPlus(int, usr, apply);
  return edit(int, trust);
}

/** @type {member} */
async function watchUser(int, usr, apply = true) {
  const watching = await c.watch(int, usr, apply);
  return edit(int, watching);
}

/** @type {member} */
async function warnUser(int, usr) {
  const res = await getReason(int, "What's the warning for?");
  if (!res) return;

  const warn = await c.warn(int, res.reason, 1, usr);
  return edit(res.modalSubmit, warn);
}
/** @type {message} */
async function modDiscussion(int, msg) {
  if (!msg) return edit(int, "I couldn't find that message!");
  const md = int.client.getTextChannel(u.sf.channels.mods.discussion);
  const embed = u.msgReplicaEmbed(msg, "", true)
    .setFooter({ text: `Linked by ${u.escapeText(int.member.displayName)}` })
    .setColor(c.colors.action);
  md?.send({ embeds: [embed] }).catch(u.noop);
  return edit(int, `I forwarded the message to ${md}!`);
}
/** @type {member} */
async function muteUser(int, usr, apply = true) {
  let mute;
  if (!apply) {
    mute = await c.mute(int, usr, undefined, false);
  } else {
    const res = await getReason(int, "Why are they being muted?");
    if (!res) return;

    mute = await c.mute(int, usr, res.reason, true);
  }

  return edit(int, mute);
}

/** @type {member} */
async function timeoutUser(int, usr) {
  const res = await getReason(int, "What's the timeout for?");
  if (!res) return;

  const timeout = await c.timeout(int, usr, 10, res.reason);
  return edit(res.modalSubmit, timeout);
}

/** @type {member} */
async function kickUser(int, usr) {
  const res = await getReason(int, "What's the kick for?");
  if (!res) return;

  const kickResponse = await c.kick(res.modalSubmit, usr, res.reason);
  if (!kickResponse) return;

  return edit(kickResponse.interaction, kickResponse.payload);
}
/** @type {member} */
async function banUser(int, usr) {
  const res = await getReason(int, "What's the ban for?");
  if (!res) return;

  const kickResponse = await c.ban(res.modalSubmit, usr, res.reason);
  if (!kickResponse) return;

  return edit(kickResponse.interaction, kickResponse.payload);
}
/** @type {message} */
async function warnMessage(int, msg) {
  if (!msg) return msgErr(int);

  const usr = msg.member;
  if (!usr) return usrErr(int);

  const res = await getReason(int, "What's the warning for?");
  if (!res) return;

  const warn = await c.warn(int, res.reason, 1, usr, msg);
  u.clean(msg, 0);
  return edit(res.modalSubmit, warn);
}
/** @type {message} */
async function purgeChannel(int, msg) {
  if (!msg) return msgErr(int);
  const channel = int.channel;
  if (!channel) return edit(int, "Well that's awkward, I can't access the channel you're in!");

  u.clean(msg, 0);
  const toDelete = await channel.messages.fetch({ after: msg.id, limit: 100 }).catch(u.noop);
  if (!toDelete) return edit(int, "I couldn't get those messages.");
  const deleted = await channel.bulkDelete(toDelete, true);

  int.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
    u.embed({ author: int.member })
      .setTitle("Channel Purge")
      .addFields(
        { name: "Mod", value: int.member.toString() },
        { name: "Channel", value: int.channel.toString() },
        { name: "Message Count", value: (deleted.size + 1).toString() }
      )
      .setColor(c.colors.info)
  ] });
  edit(int, `I deleted ${deleted.size + 1}/${toDelete.size + 1} messages!`);
}
/** @type {message} */
async function spamCleanup(int, msg) {
  if (!msg) return msgErr(int);
  await edit(int, "Searching for and cleaning spam...");
  const cleaned = await c.spamCleanup([msg.content.toLowerCase()], msg.guild, msg, false, true);
  if (!cleaned) return edit(int, "I couldn't find any recent messages that matched this one.");
  // Log it
  int.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
    u.embed({ author: int.member })
      .setTitle("Channel Purge")
      .addFields(
        { name: "Mod", value: int.member.toString() },
        { name: "Channel(s)", value: cleaned.channels.join(', ') },
        { name: "Message Count", value: cleaned.deleted.toString() },
        { name: "Reason", value: "Spam" }
      )
      .setColor(c.colors.info)
  ] });

  edit(int, `I deleted ${cleaned.deleted} messages in ${cleaned.channels.length} channel(s):\n${cleaned.channels.join("\n")}`.substring(0, 4000));
}
/** @type {message} */
async function announceMessage(int, msg) {
  if (!msg) return msgErr(int);
  await int.client.getTextChannel(u.sf.channels.announcements)?.send({ embeds: [u.msgReplicaEmbed(msg, ""), ...msg.embeds] });
  return edit(int, "Message announced!");
}
/**
 * @param {Augur.GuildInteraction<"SelectMenuString">} submitted
 * @param {Augur.GuildInteraction<"ContextBase">} oldInt
*/
async function handleModMenu(submitted, oldInt) {
  const components = permComponents(oldInt);
  const command = submitted.values[0];
  const component = components.find(cmp => cmp.value === command);
  if (!component) return submitted.update({ content: "I couldn't find that command!", components: [] });

  const message = oldInt.isMessageContextMenuCommand() ? oldInt.targetMessage : null;
  const user = oldInt.isUserContextMenuCommand() ? oldInt.targetMember ?? oldInt.targetUser : message?.member ?? null;
  if (!user && !message) return u.errorHandler(new Error("No user or message on modMenu"), submitted);

  // These commands require additional input and can't be defered
  switch (command) {
    case "noteUser": return noteUser(submitted, user);
    case "warnMessage": return warnMessage(submitted, message);
    default: break;
  }

  // These commands require a member
  if (!message) {
    if (!memberTest(submitted, user)) return;
    switch (command) {
      case "renameUser": return renameUser(submitted, user);
      case "warnUser": return warnUser(submitted, user);
      case "muteUser": return muteUser(submitted, user, true);
      case "timeoutUser": return timeoutUser(submitted, user);
      case "kickUser": return kickUser(submitted, user);
      case "banUser": return banUser(submitted, user);
      default: break;

    }
  }

  // These ones don't require additional inputs
  await submitted.deferUpdate();
  switch (command) {
    case "modDiscussion": return modDiscussion(submitted, message);
    case "purgeChannel": return purgeChannel(submitted, message);
    case "spamCleanup": return spamCleanup(submitted, message);
    case "announceMessage": return announceMessage(submitted, message);
    case "userAvatar": return avatar(submitted, user);
    case "flag": return flagReason(submitted, message, user);
    case "pinMessage": return pin(submitted, message);
    case "userSummary": return userSummary(submitted, user);
    default: break;
  }

  // Anything beyond this point requires a member
  if (!memberTest(submitted, user)) return;
  switch (command) {
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
function permComponents(int) {
  let components = [...menuOptions.everyone];
  if (!c.getBanList().features.flag.includes(int.user.id)) components.push(menuOptions.flag);
  if (u.perms.calc(int.member, ['mod', 'mgr'])) components = components.concat(menuOptions.mod);
  if (u.perms.calc(int.member, ['mgr', 'mgmt'])) components = components.concat(menuOptions.mgmt);
  return components.filter(cmp => (
    cmp.context === 'msg' && int.isMessageContextMenuCommand() ||
    cmp.context === 'user' && int.isUserContextMenuCommand() ||
    cmp.context === 'any'
  ));
}

/** @param {Augur.GuildInteraction<"ContextMessage"|"ContextUser">} int */
async function sendModMenu(int) {
  await int.deferReply({ flags: ["Ephemeral"] });
  const id = u.customId();
  const components = permComponents(int);
  const actionRow = u.MessageActionRow()
    .setComponents(
      new u.SelectMenu.String()
        .setCustomId(id)
        .setMaxValues(1)
        .setMinValues(1)
        .setOptions(components.map(cmp =>
          new u.SelectMenu.StringOption()
            .setDefault(false)
            .setDescription(cmp.description)
            .setEmoji(cmp.emoji)
            .setLabel(cmp.label)
            .setValue(cmp.value)
        ))
    );

  /** @param {Discord.StringSelectMenuInteraction} i*/
  const filter = (i) => i.customId === id && i.user.id === int.user.id;
  const msg = await edit(int, { components: [actionRow] });
  const component = await msg.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time, dispose: true, filter }).catch(() => {
    edit(int, noTime);
  });
  if (component && component.inCachedGuild()) handleModMenu(component, int);
}

const Module = new Augur.Module()
  .addInteraction({
    name: "msgModMenu",
    id: u.sf.commands.messageModeration,
    type: "ContextMessage",
    onlyGuild: true,
    process: sendModMenu
  })
  .addInteraction({
    name: "usrModMenu",
    id: u.sf.commands.userModeration,
    type: "ContextUser",
    onlyGuild: true,
    process: sendModMenu
  });

module.exports = Module;