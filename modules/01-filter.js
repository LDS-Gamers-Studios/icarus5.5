// @ts-check
const Augur = require("augurbot-ts"),
  banned = require("../data/banned.json"),
  Discord = require("discord.js"),
  config = require('../config/config.json'),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon");


const bannedWords = new RegExp(banned.words.join("|"), "i"),
  hasLink = /(>?(>?http[s]?|ftp):\/\/)([\w.-]+\.)?([\w.-]+\.[^/\n ]+)(\/[^ \n]+)?/gi;

let pf = new profanityFilter();

/** @type {Set<string>} */
const processing = new Set();

// first value is for trusted, second is for non-trusted
const thresh = config.spamThreshold;

/**
 * @typedef message
 * @prop {string} content
 * @prop {number} createdTimestamp
 * @prop {string} channelId
 * @prop {string} id
 *
 * @typedef activeMember
 * @prop {string} author
 * @prop {message[]} messages
 * @prop {number} [verdict]
 * @prop {number} [count]
 * @prop {boolean} handling
 */
/** @type {Discord.Collection<string, activeMember> } */
const active = new u.Collection();

/** @param {Discord.Message<true>} msg*/
async function spamming(msg) {
  if (!msg.member || msg.author.bot) return;
  // update message cache
  const history = active.get(msg.author.id) ?? {
    author: msg.author.id,
    /** @type {message[]} */
    messages: [],
    handling: false
  };

  if (history.handling) return;

  const newMessage = {
    content: msg.content,
    createdTimestamp: msg.createdTimestamp,
    channelId: msg.channelId,
    id: msg.id
  };
  history.messages.push(newMessage);

  active.set(msg.author.id, history);
  // get relavent messages
  const messages = history.messages.filter(m => m.createdTimestamp >= msg.createdTimestamp - (thresh.time * 1000));
  const channels = u.unique(messages.map(m => m.channelId));
  /** @type {Discord.Collection<string, number>} */
  const contents = new u.Collection();
  for (const message of messages) {
    if (!message.content) continue;
    const content = message.content.toLowerCase();
    const prev = contents.get(content) ?? 0;
    contents.set(content, prev + 1);
  }
  const filteredContents = contents.filter(m => m > thresh.same);
  // determine outcome
  let verdict = 0;
  if (filteredContents.size > 0) verdict = 2;
  else if (channels.length > thresh.channels) verdict = 0;
  else if (messages.length > thresh.messages) verdict = 1;
  else return;

  const verdictString = [
    `Posted in too many channels (${channels.length}/${thresh.channels}) too fast`,
    `Posted too many messages (${messages.length}/${thresh.messages})`,
    `Posted the same message too many times (${filteredContents.reduce((p, v) => p + v, 0)}/${thresh.same})`,
  ];
  if (verdict < 2) {
    c.timeout(null, msg.member, 0.2, verdict === 0 ? "Channel Spam" : "Message Spam");
  } else {
    history.handling = true;
    active.set(msg.author.id, history);
    c.spamCleanup([...filteredContents.keys()], msg.guild, msg, true).then((results) => {
      const embed = u.embed({ author: msg.member })
        .setColor(c.colors.info)
        .setTitle("Spam Cleanup Results")
        .setDescription(`${results.deleted} messages deleted in the following channels:\n${results.channels.join("\n")}`);

      msg.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
    });
  }
  c.createFlag({ msg, member: msg.member, flagReason: verdictString[verdict] + "\nThere may be additional spammage that I didn't catch.", pingMods: verdict === 2 });
}

/**
 * Filter some text, warn if appropriate.
 * @param {String} text The text to scan.
 */
function filter(text) {
  // PROFANITY FILTER
  const noWhiteSpace = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~"'()?|]/g, "").replace(/\s\s+/g, " ");
  const filtered = pf.scan(noWhiteSpace);
  if ((filtered.length > 0) && filtered[0] && (noWhiteSpace.length > 0)) return filtered;
  return [];
}

/**
 * Process discord message language
 * @param {Discord.Message} msg Message
 */
async function processMessageLanguage(msg, edit = false) {
  if (!msg.member) return;
  let matchedContent = [];
  const reasons = [];
  let warned = false;
  let pingMods = false;
  if (!msg.inGuild() || msg.guild.id !== u.sf.ldsg || msg.channel.id === u.sf.channels.modWatchList) return;

  if (!edit) spamming(msg);

  const invites = await processDiscordInvites(msg);
  if (invites) {
    matchedContent = matchedContent.concat(invites.invites);
    reasons.push("Automatic Discord Invite Removal");
    warned = true;
  } else if (c.grownups.has(msg.channel.id)) {
    return;
  }

  /** @param {{tld: string | undefined, url: string}} l */
  const linkMap = (l) => (l.tld ?? "") + l.url;

  /** @param {string} prop @param {{tld: string | undefined, url: string}} l */
  const linkFilter = (prop, l) => new RegExp(banned[prop].join('|'), 'gi').test(linkMap(l));


  // LINK FILTER
  let link = null;
  /** @type {Discord.Collection<string, {tld: string | undefined, url: string}>} */
  const matchedLinks = new u.Collection();
  let matchedWords = null;
  let gif = false;
  while ((link = hasLink.exec(msg.cleanContent)) !== null) {
    matchedLinks.set((link[3] ?? "") + link[4], { tld: link[3], url: link[4] });
  }
  if (matchedLinks.size > 0) {
    const bannedLinks = matchedLinks.filter(l => linkFilter("links", l)).map(linkMap);
    const scamLinks = matchedLinks.filter(l => linkFilter("scam", l)).filter(l => !linkFilter("exception", l)).map(linkMap);
    // Naughty Links
    if (bannedLinks.length > 0) {
      matchedContent = matchedContent.concat(bannedLinks);
      reasons.push("Dangerous Link");
    } else if (scamLinks.length > 0) {
      // Scam Links
      u.clean(msg, 0);
      if (!warned) msg.reply({ content: "That link is generally believed to be a scam/phishing site. Please be careful!", failIfNotExists: false }).catch(u.noop);
      warned = true;
      matchedContent = matchedContent.concat(scamLinks);
      reasons.push("Suspected Scam Links (Auto-Removed)");
    } else if (bannedWords.exec(msg.cleanContent) && matchedLinks.find(l => l.url.includes("tenor") || l.url.includes("giphy"))) {
      // Bad gif link
      u.clean(msg, 0);
      if (!warned) msg.reply({ content: "Looks like that link might have some harsh language. Please be careful!", failIfNotExists: false }).catch(u.noop);
      warned = true;
      gif = true;
      matchedContent = matchedContent.concat(matchedLinks.map(linkMap), bannedWords.exec(msg.cleanContent));
      reasons.push("Gif Link Language (Auto-Removed)");
    } else if (!msg.webhookId && !msg.author.bot && !msg.member?.roles.cache.has(u.sf.roles.trusted)) {
      // General untrusted link flag
      matchedContent = matchedContent.concat(matchedLinks.map(linkMap));
      reasons.push("Links prior to being trusted");
    }
  }

  // HARD LANGUAGE FILTER
  if ((matchedWords = msg.cleanContent.match(bannedWords)) && !gif) {
    matchedContent = matchedContent.concat(matchedWords);
    reasons.push("Automute Word Detected");
    pingMods = true;
    c.watch(msg, msg.member ?? msg.author.id, true);
  }

  // SOFT LANGUAGE FILTER
  const soft = filter(msg.cleanContent);
  if (soft.length > 0) {
    matchedContent = matchedContent.concat(soft);
    reasons.push("Profanity Detected");
  }

  // LINK PREVIEW FILTER
  if (msg.author.id !== msg.client.user.id) {
    for (const embed of msg.embeds) {
      const preview = [embed.author?.name ?? "", embed.title ?? "", embed.description ?? ""].join("\n").toLowerCase();
      const previewBad = preview.match(bannedWords) ?? [];
      if (previewBad.length > 0) {
        u.clean(msg, 0);
        if (!warned && !msg.author.bot && !msg.webhookId) msg.reply({ content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
        warned = true;
        matchedContent = matchedContent.concat(previewBad);
        reasons.push("Link Preview Language (Auto-Removed)");
      }
      if (filter(preview).length > 0) {
        if (!warned && !msg.author.bot && !msg.webhookId) msg.reply({ content: "It looks like that link might have some language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
        warned = true;
        msg.suppressEmbeds().catch(u.noop);
        break;
      }
    }
  }
  if (matchedContent.length > 0) {
    msg.content = msg.cleanContent.replace(new RegExp(matchedContent.join("|"), "gi"), (str) => `**${str}**`).replace(/https?(:\/\/)/g, "");
    await c.createFlag({ msg, member: msg.member ?? msg.author, matches: matchedContent, flagReason: reasons.join("\n"), pingMods });
    if (invites) msg.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [invites.embed] });
  }
}

/**
 * Filters invites for the server, deletes the message and notifies the user, and returns an embed with content about the invite
 * @param {(Discord.Invite|Discord.Widget)[]} [invites]
 * @param {string[]} rawInvites
 * @param {Discord.Message} msg
 */
function reportInvites(msg, rawInvites, invites) {
  /** @type {string[]} */
  let external = [];
  if (invites && (invites.length > 0)) {
    external = invites.filter(i => (i instanceof Discord.Widget ? i.id : i.guild?.id) !== u.sf.ldsg)
      .map(i => i instanceof Discord.Widget ? `Guild: ${i.name}` : `Guild: ${i.guild?.name ?? "Unknown"}, Channel: ${i.channel?.name ?? "Unkonwn"}`);
  } else {
    external = rawInvites.filter(i => !i.endsWith("ldsg")).map(() => "Guild: Unknown, Channel: Unknown");
  }
  if (external.length === 0) return null;
  if (msg.webhookId || msg.author.bot) {
    for (const invite of rawInvites) msg.content = msg.content.replace(invite, "[Discord Invite]");
    u.clean(msg, 0);
    const embed = u.embed({ author: msg.author }).setDescription(msg.content);
    msg.channel.send({ embeds: [embed, ...msg.embeds], files: Array.from(msg.attachments.values()) });
    return null;
  }
  if (!msg.member) return null;
  const embed = u.embed({ author: msg.author })
    .setTitle("⏫ Invite Info")
    .setDescription(external.join("\n"))
    .setColor(c.colors.info);
  u.clean(msg, 0);
  msg.channel.send({ embeds: [
    u.embed({
      description: "It is difficult to know what will be in another Discord server at any given time. " +
      "*If* you feel that this server is appropriate to share, please only do so in direct messages."
    })
  ] }).then(u.clean);
  return { embed, invites: rawInvites };
}

/**
 * Process Discord invites
 * @param {Discord.Message} msg Original message
 */
async function processDiscordInvites(msg) {
  if (!msg.inGuild()) return null;
  const bot = msg.client;
  const inviteRegex = /(https?:\/\/)?discord(app)?\.(gg(\/invite)?\/|com\/(invite|events)\/)(\w+)/ig;
  const matched = msg.cleanContent.match(inviteRegex);
  if (!matched) return null;
  const code = matched.map(m => ({ event: /discord(app)?\.com\/events/i.test(m), code: m.replace(/(https?:\/\/)?discord(app)?\.(gg(\/invite)?\/|com\/(invite|events)\/)/, "") }));
  const filtered = code.filter(co => co.code !== msg.guild.id);
  if (filtered.length === 0) return null;
  const foundInvites = filtered.map(inv => inv.event ? bot.fetchGuildWidget(inv.code) : bot.fetchInvite(inv.code.trim()));
  try {
    const resolved = await Promise.all(foundInvites);
    return reportInvites(msg, matched, resolved);
  } catch (error) {
    if (error && ["Unknown Invite", "Unknown Guild", "Widget Disabled"].includes(error.message)) return reportInvites(msg, matched);
    u.errorHandler(error, msg);
    return null;
  }
}

/**
 * Process the warning card
 * @param {Discord.ButtonInteraction<"cached">} interaction The interaction of a mod selecting the button.
 */
async function processCardAction(interaction) {
  try {
    const flag = interaction.message;
    // Prevent double-processing
    if (processing.has(flag.id)) {
      interaction.reply({ content: "Someone is already processing this flag!", ephemeral: true });
      return;
    }

    processing.add(flag.id);

    const mod = interaction.member,
      embed = u.embed(flag.embeds[0]),
      infraction = await u.db.infraction.getByFlag(flag.id);

    if (interaction.customId === "modCardCensor") {
      // Censor the flag with a description of the content
      const modal = new u.Modal().addComponents(
        u.ModalActionRow().addComponents([
          new u.TextInput()
            .setCustomId("text")
            .setLabel("Replacement Text")
            .setStyle(Discord.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("A description of the content")
        ])
      ).setCustomId("modalCensor").setTitle("Censor Mod Card");
      await interaction.showModal(modal);
      const submitted = await interaction.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(() => {
        return null;
      });
      if (!submitted) {
        interaction.editReply("I fell asleep waiting for your input...");
        return processing.delete(flag.id);
      }
      await submitted.deferUpdate();
      embed.data.fields = embed.data.fields?.filter(f => !f.name.startsWith("Matched"));
      embed.setDescription(submitted.fields.getTextInputValue("text"));
      submitted.editReply({ embeds: [embed], components: [] });
      return processing.delete(flag.id);
    }
    if (!infraction) {
      interaction.reply({ content: "I couldn't find that flag!", ephemeral: true });
      return processing.delete(flag.id);
    }

    if (interaction.customId === "modCardInfo") {
      // Don't count this as processing
      processing.delete(flag.id);
      await interaction.deferReply({ ephemeral: true });
      const member = await interaction.guild.members.fetch(infraction.discordId);
      let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
      if (roleString.length > 1024) roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + " ...";

      const userDoc = await u.db.user.fetchUser(member.id);
      if (!userDoc) return interaction.editReply("I couldn't find any info on them.");

      const e = await c.getSummaryEmbed(member);

      interaction.editReply({ embeds: [e] });
      return;
    } else if (interaction.customId === "modCardLink") {
      // LINK TO #MODDISCUSSION
      const md = interaction.client.getTextChannel(u.sf.channels.moddiscussion);
      await interaction.reply({ content: `Sending the flag over to ${md}...`, ephemeral: true });

      embed.setFooter({ text: `Linked by ${u.escapeText(mod.displayName)}` });
      md?.send({ embeds: [embed] }).catch(u.noop);
      return processing.delete(flag.id);
    }

    // The buttons after this actually need mod filtering
    if (infraction && mod.id === infraction.discordId) {
      await interaction.reply({ content: "You can't handle your own flag!", ephemeral: true });
      return processing.delete(flag.id);
    }

    const member = interaction.guild.members.cache.get(infraction.discordId);

    if (interaction.customId === "modCardClear") {
      // IGNORE FLAG
      await interaction.deferUpdate();
      infraction.value = -1;
      infraction.handler = mod.id;
      await u.db.infraction.update(infraction);
      embed.setColor(c.colors.success)
        .addFields({ name: "Resolved", value: `${mod.toString()} cleared the flag.` });
      const comps = c.revert.toJSON();
      if (flag.mentions.roles.has(u.sf.roles.mod)) comps.components.push(c.unmute.toJSON()); // give option to unmute if mods are pinged
      embed.data.fields = embed.data.fields?.filter(f => !f.name.startsWith("Reverted"));
      await interaction.editReply({ embeds: [embed], components: [comps] });
    } else if (interaction.customId === "modCardRetract") {
      // Only the person who acted on the card (or someone in management) can retract an action
      if (infraction.handler !== mod.id && !u.perms.calc(interaction.member, ['mgmt'])) return interaction.reply({ content: "That isn't your card to retract!", ephemeral: true });
      await interaction.deferUpdate();
      const verbal = embed.data.fields?.find(f => f.value.includes("verbal"));
      const revertedMsg = "The offending message can't be restored" + (infraction.value > 9 ? " and the Muted role may have to be removed and the user unwatched." : ".");
      embed.setColor(c.colors.action)
      .setFields(embed.data.fields?.filter(f => !f.name.startsWith("Resolved") && !f.name.startsWith("Reverted")) ?? [])
      .addFields({ name: "Reverted", value: `${interaction.member} reverted the previous decision. ${infraction.value > 0 ? revertedMsg : ""}` });

      await interaction.editReply({ embeds: [embed], components: c.modActions });
      if (infraction.value > 0 || verbal) {
        await interaction.guild.members.cache.get(infraction.discordId)?.send(
          "## Moderation Update:"
          + "\nThe LDSG Mods have retracted their previous decision. It may be that they previously clicked the wrong button or are considering a different outcome."
          + "\nPlease be patient while the mods continue to review your case. If you don't hear anything soon from me or the mods, your case was likely cleared."
        );
      }
      infraction.value = 0;
      infraction.handler = undefined;
      await u.db.infraction.update(infraction);
    } else if (interaction.customId === "modCardUnmute") {
      const comps = c.revert.toJSON();
      comps.components.push(c.unwatch.toJSON());
      if (!member) {
        interaction.reply({ content: "I couldn't find that user!", ephemeral: true });
      } else if (!interaction.member.roles.cache.has(u.sf.roles.muted)) {
        interaction.reply({ content: "That user isn't muted!", ephemeral: true });
        interaction.message.edit({ components: [comps] });
      } else {
        embed.addFields({ name: "Unmuted", value: `${c.userBackup(interaction.member)} unmuted the user.` });
        await interaction.deferUpdate();
        await member.roles.remove(u.sf.roles.muted);
        interaction.editReply({ embeds: [embed], components: [comps] });
      }
    } else if (interaction.customId === "modCardUnwatch") {
      if (!member) {
        interaction.reply({ content: "I couldn't find that user!", ephemeral: true });
      } else if (!c.watchlist.has(member.id)) {
        interaction.reply({ content: "That user isn't being watched!", ephemeral: true });
        interaction.message.edit({ components: [c.revert] });
      } else {
        embed.addFields({ name: "Unwatched", value: `${c.userBackup(interaction.member)} unwatched the user.` });
        await interaction.deferUpdate();
        await c.watch(interaction, member, false);
        interaction.editReply({ embeds: [embed], components: [c.revert] });
      }
    } else {
      await interaction.deferUpdate();
      embed.setColor(c.colors.handled);
      infraction.handler = mod.id;

      switch (interaction.customId) {
        case "modCardVerbal":
          infraction.value = 0;
          embed.addFields({ name: "Resolved", value: `${mod.toString()} issued a verbal warning.` });
          break;
        case "modCardMinor":
          infraction.value = 1;
          embed.addFields({ name: "Resolved", value: `${mod.toString()} issued a 1 point warning.` });
          break;
        case "modCardMajor":
          infraction.value = 5;
          embed.addFields({ name: "Resolved", value: `${mod.toString()} issued a 5 point warning.` });
          break;
        case "modCardMute":
          infraction.value = 10;
          if (member && !member.roles.cache.has(u.sf.roles.muted)) {
            // Only mute if they weren't already muted.
            try {
              await member.roles.add(u.sf.roles.muted);
              if (member.voice.channel) await member.voice.disconnect("User mute").catch(u.noop);
              interaction.client.getTextChannel(u.sf.channels.muted)?.send({
                content: `${member}, you have been muted in ${member.guild.name}. Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct`,
                allowedMentions: { users: [member.id] }
              }).catch(u.noop);
            } catch (error) { u.errorHandler(error, "Mute user via card"); }
          } else if (!member) {
            // Apply muted roles in post
            const roles = (await u.db.user.fetchUser(infraction.discordId))?.roles.concat(u.sf.roles.muted) ?? [];
            await u.db.user.updateRoles(undefined, roles, infraction.discordId);
            await c.watch(interaction, member ?? infraction.discordId, true);
          }
          embed.addFields({ name: "Resolved", value: `${mod} muted the member.` });
          break;
        default:
          u.errorHandler(new Error("Unhandled Mod Button Case"), interaction);
          processing.delete(flag.id);
          return;
      }
      await u.db.infraction.update(infraction);
      const infractionSummary = await u.db.infraction.getSummary(infraction.discordId);

      if (member && infraction.channel) {
        const quote = u.embed({ author: member })
          .addFields({ name: "Channel", value: `#${interaction.client.getTextChannel(infraction.channel)?.name ?? "Unknown Channel"}` })
          .setDescription(embed.data.description ?? null)
          .setTimestamp(flag.createdAt)
          .setFooter({ text: "There may have been an attachment or sticker" });

        const response = "## 🚨 Message from the LDSG Mods:\n" + (
          (infraction.value === 0) ?
            `We would like to speak with you about the following post. It may be that we're looking for some additional context or just want to handle things informally.\n\n**${mod.toString()}** will be reaching out to you shortly, if they haven't already.` :
            c.warnMessage(mod.displayName)
        );

        member.send({ content: response, embeds: [quote] }).catch(() => c.blocked(member));
      }

      const dummy = { value: "" };
      embed.data.fields = embed.data.fields?.filter(f => !f.name || !f.name.startsWith("Jump") && !f.name.startsWith("Reverted"));
      (embed.data.fields?.find(f => f.name?.startsWith("Infraction")) ?? dummy).vlaue = `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}`;

      await interaction.editReply({ embeds: [embed], components: [c.revert] }).catch(() => {
        interaction.message.edit({ embeds: [embed], components: [c.revert] }).catch((error) => u.errorHandler(error, interaction));
      });

      if (infraction.value > 0) {
        try {
          const msg = await interaction.client.getTextChannel(infraction.channel ?? "")?.messages.fetch(infraction.message ?? "");
          if (msg) u.clean(msg, 0);
        } catch (e) { u.noop(); }
      }
    }

    processing.delete(flag.id);
  } catch (error) { u.errorHandler(error, interaction); }
}

/********************
**  Filter Events  **
********************/
const Module = new Augur.Module()
.addEvent("messageCreate", processMessageLanguage)
.addEvent("messageEdit", async (old, newMsg) => {
  processMessageLanguage(newMsg, true);
})
.addEvent("interactionCreate", (int) => {
  if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;
  if (!['clear', 'verbal', 'minor', 'major', 'mute', 'info', 'link', 'retract', 'unmute', 'unwatch', 'censor'] // mod card actions minus the modCard part
    .includes(int.customId.replace("modCard", "").toLowerCase())) return;
  if (!u.perms.calc(int.member, ["mod", "mcMod", "mgr"])) {
    return int.reply({ content: "You don't have permissions to interact with this flag!", ephemeral: true });
  }
  processCardAction(int);
})
.setClockwork(() => {
  return setInterval(() => {
    for (const [id, member] of active) {
      const newMsgs = member.messages.filter(m => m.createdTimestamp + (thresh.time * 1000) >= Date.now());
      if (newMsgs.length === member.messages.length) continue;
      if (newMsgs.length === 0) active.delete(id);
      else active.set(id, Object.assign(member, { messages: newMsgs }));
    }
  }, 5 * 60 * 1000);
})
// @ts-ignore it does exist...
.addEvent("filterUpdate", () => pf = new profanityFilter())
.setUnload(() => c.grownups)
.setInit((grown) => grown ? c.grownups = grown : null);


module.exports = Module;
