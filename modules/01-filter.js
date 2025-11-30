// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  config = require('../config/config.json'),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon");

let banned = c.getBanList();

let bannedWords = new RegExp(banned.words.join("|"), "i");

let linkFilters = {
  links: new RegExp(banned.links.join("|"), "gi"),
  scam: new RegExp(banned.scam.join("|"), "gi"),
  exception: new RegExp(banned.exception.join("|"), "gi"),
};
const hasLink = /(>?(>?http[s]?|ftp):\/\/)([\w.-]+\.)?([\w.-]+\.[^/\n ]+)(\/[^ \n]+)?/gi;

let pf = new profanityFilter();

/** @type {Set<string>} */
const processing = new Set();

/**
 * @typedef activeMember
 * @prop {string} id
 * @prop {Discord.Message<true>[]} messages
 * @prop {number} [verdict]
 * @prop {number} [count]
 */

/** @type {Discord.Collection<string, activeMember> } */
const active = new u.Collection();

/** @param {Discord.Message<true>} newMsg*/
async function checkSpamming(newMsg) {
  if (!newMsg.content || !newMsg.member) return;

  // add user and message to active list
  const messages = active.ensure(newMsg.author.id, () => ({ id: newMsg.author.id, messages: [] })).messages;
  messages.push(newMsg);

  // If they haven't posted enough messages, don't bother continuing
  const threshold = config.spamThreshold.messageCount;
  if (messages.length < threshold) return;

  // group messages by their content
  /** @type {Discord.Collection<string, { content: string, count: number }>} */
  const sameMessages = new u.Collection();
  for (const msg of messages) {
    if (Date.now() - msg.createdTimestamp > (config.spamThreshold.time * 1000)) continue;
    const content = msg.content.toLowerCase();
    sameMessages.ensure(content, () => ({ content, count: 0 })).count++;
  }

  // find any groups that match or exceed the threshold
  // subtracts one since the last of multiple repeated spammed messages would be blocked
  const isSpamming = sameMessages.find(m => m.count >= threshold);
  if (!isSpamming) return;
  const spamMessages = sameMessages.filter(m => m.count >= threshold - 1);

  // clean up and report the spam
  const verdictString = `Posted the same message too many times (${spamMessages.map(m => `${m.count}/${threshold}`).join(", ")})\nThere may be additional spammage that I didn't catch.`;
  c.spamCleanup(spamMessages.map(m => m.content), newMsg.guild, newMsg, true);

  c.createFlag({
    msg: newMsg,
    member: newMsg.member,
    flagReason: verdictString,
    pingMods: true
  });

  // remove them from the spam list
  active.delete(newMsg.author.id);
}

/**
 * Filter some text, warn if appropriate.
 * @param {String} text The text to scan.
 */
function softFilter(text) {
  // PROFANITY FILTER
  const noWhiteSpace = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~"'()?|]/g, "").replace(/\s\s+/g, " ");
  const filtered = pf.scan(noWhiteSpace);
  if ((filtered.length > 0) && filtered[0] && (noWhiteSpace.length > 0)) return filtered;
  return [];
}

/** @param {Discord.Message<true>} msg */
function linkFilter(msg) {
  /** @param {{tld: string | undefined, url: string}} l */
  const linkMap = (l) => (l.tld ?? "") + l.url;

  /** @param {RegExp} regex @param {{tld: string | undefined, url: string}} l */
  const linkTest = (regex, l) => regex.test(linkMap(l));


  // Match all links
  let link = null;

  /** @type {Discord.Collection<string, {tld: string | undefined, url: string}>} */
  const matchedLinks = new u.Collection();

  while ((link = hasLink.exec(msg.cleanContent)) !== null) {
    matchedLinks.set((link[3] ?? "") + link[4], { tld: link[3], url: link[4] });
  }

  // Match flags
  /** @type {string[]} */
  const matchedContent = [];
  /** @type {string[]} */
  const reasons = [];
  let deleteMsg = false;
  let warning = "";
  let isGif = false;

  if (matchedLinks.size > 0) {
    const bannedMatched = msg.cleanContent.match(bannedWords);
    const bannedLinks = matchedLinks.filter(l => linkTest(linkFilters.links, l)).map(linkMap);
    const scamLinks = matchedLinks.filter(l => linkTest(linkFilters.scam, l)).filter(l => !linkTest(linkFilters.exception, l)).map(linkMap);

    if (bannedLinks.length > 0) {
      matchedContent.push(...bannedLinks);
      reasons.push("Dangerous Link");
    } else if (scamLinks.length > 0) {
      // Scam Links
      reasons.push("Suspected Scam Links (Auto-Removed)");
      matchedContent.push(...scamLinks);

      deleteMsg = true;
      warning = "That link is generally believed to be a scam/phishing site. Please be careful!";
    } else if (bannedMatched && matchedLinks.find(l => l.url.includes("tenor") || l.url.includes("giphy"))) {
      // Bad gif link
      reasons.push("Gif Link Language (Auto-Removed)");
      matchedContent.push(...matchedLinks.map(linkMap), ...bannedMatched);

      deleteMsg = true;
      warning = "Looks like that link might have some harsh language. Please be careful!";
      isGif = true;
    } else if (!msg.webhookId && !msg.author.bot && !msg.member?.roles.cache.has(u.sf.roles.moderation.trusted)) {
      // General untrusted link flag
      reasons.push("Links prior to being trusted");
      matchedContent.push(...matchedLinks.map(linkMap));
    }
  }

  return { deleteMsg, warning, isGif, matchedContent, reasons };
}

/**
 * Process discord message language
 * @param {Discord.Message} msg Message
 */
async function processMessageLanguage(msg, isEdit = false) {
  if (!msg.member) return;
  if (!msg.inGuild() || msg.guild.id !== u.sf.ldsg || msg.channel.id === u.sf.channels.mods.watchList) return;

  // CHARLEMANGE FILTER (lol)
  if (msg.author.id === u.sf.other.charlemange && msg.content.startsWith("WARNING: Removal of")) {
    return u.clean(msg, 0);
  }

  /** @type {string[]} */
  let matchedContent = [];

  /** @type {string[]} */
  const reasons = [];

  let warned = false;
  let pingMods = false;

  // SPAM FILTER
  if (!msg.author.bot && !msg.webhookId && !c.grownups.has(msg.channel.id) && !isEdit) {
    checkSpamming(msg);
  }

  // INVITE FILTER
  const invites = await processDiscordInvites(msg);
  if (invites) {
    matchedContent = matchedContent.concat(invites.invites);
    reasons.push("Automatic Discord Invite Removal");
    warned = true;
  } else if (c.grownups.has(msg.channel.id)) {
    return;
  }

  // LINK FILTER
  const { deleteMsg, isGif, warning, matchedContent: matchedInLink, reasons: linkReasons } = linkFilter(msg);
  if (deleteMsg) u.clean(msg, 0);
  if (warning && !warned) {
    msg.reply({ content: warning, failIfNotExists: false }).catch(u.noop);
    warned = true;
  }

  reasons.push(...linkReasons);
  matchedContent = matchedContent.concat(matchedInLink);


  // HARD LANGUAGE FILTER
  const matchedWords = msg.cleanContent.match(bannedWords);
  if (matchedWords && !isGif) {
    matchedContent = matchedContent.concat(matchedWords);
    reasons.push("Automute Word Detected");
    pingMods = true;
    c.watch(msg, msg.member ?? msg.author.id, true);
  }

  // SOFT LANGUAGE FILTER
  const soft = softFilter(msg.cleanContent);
  if (soft.length > 0) {
    matchedContent = matchedContent.concat(soft);
    reasons.push("Profanity Detected");
  }

  // LINK PREVIEW FILTER
  if (msg.author.id !== msg.client.user.id) {
    for (const embed of msg.embeds) {
      const preview = [embed.author?.name ?? "", embed.title ?? "", embed.description ?? ""].join("\n").toLowerCase();

      // HARD FILTER
      const previewBad = preview.match(bannedWords) ?? [];
      if (previewBad.length > 0) {
        u.clean(msg, 0);
        if (!warned && !msg.author.bot && !msg.webhookId) msg.reply({ content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
        warned = true;
        matchedContent = matchedContent.concat(previewBad);
        reasons.push("Link Preview Harsh Language (Auto-Removed)");
      }

      // SOFT FILTER
      if (softFilter(preview).length > 0) {
        if (!warned && !msg.author.bot && !msg.webhookId) msg.reply({ content: "It looks like that link might have some language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
        warned = true;
        msg.suppressEmbeds().catch(u.noop);
        break;
      }
    }
  }

  // REPORT MISDEEDS
  if (matchedContent.length > 0) {
    msg.content = msg.cleanContent.replace(new RegExp(matchedContent.join("|"), "gi"), (str) => `**${str}**`).replace(/https?(:\/\/)/g, "");
    await c.createFlag({
      msg,
      member: msg.member ?? msg.author,
      matches: matchedContent,
      flagReason: reasons.join("\n"),
      pingMods
    });

    if (invites) msg.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [invites.embed] });
  }
}

/**
 * Filters invites for the server, deletes the message and notifies the user, and returns an embed with content about the invite
 * @param {Discord.Message<true>} msg
 * @param {string[]} rawInvites
 * @param {(Discord.Invite|Discord.Widget)[]} [invites]
 */
function reportInvites(msg, rawInvites, invites) {
  /** @type {string[]} */
  let external = [];

  // Find guild and channel IDs
  if (invites && (invites.length > 0)) {
    external = invites
      .filter(i => (i instanceof Discord.Widget ? i.id : i.guild?.id) !== u.sf.ldsg)
      .map(i => i instanceof Discord.Widget ? `Server: ${i.name}` : `Server: ${i.guild?.name ?? "Unknown"}, Channel: ${i.channel?.name ?? "Unknown"}`);
  } else {
    external = rawInvites.filter(i => !i.endsWith("ldsg")).map(() => "Server: Unknown, Channel: Unknown");
  }

  // No non-LDSG invites found, no action needed
  if (external.length === 0) return null;

  // Repost webhook/bot messages
  if (msg.webhookId || msg.author.bot) {
    for (const invite of rawInvites) msg.content = msg.content.replace(invite, "[Discord Invite]");
    u.clean(msg, 0);
    const embed = u.embed({ author: msg.author }).setDescription(msg.content);
    msg.channel.send({ embeds: [embed, ...msg.embeds], files: Array.from(msg.attachments.values()) });

    return null;
  }

  if (!msg.member) return null;
  const logEmbed = u.embed({ author: msg.author })
    .setTitle("⏫ Invite Info")
    .setDescription(external.join("\n"))
    .setColor(c.colors.info);

  // Remove message and give a reason
  u.clean(msg, 0);
  const publicEmbed = u.embed().setDescription("It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages.");
  msg.channel.send({ embeds: [publicEmbed] }).then(u.clean);

  return { embed: logEmbed, invites: rawInvites };
}

/**
 * Process Discord invites
 * @param {Discord.Message} msg Original message
 */
async function processDiscordInvites(msg) {
  if (!msg.inGuild()) return null;

  const inviteRegex = /(https?:\/\/)?discord(app)?\.(gg(\/invite)?\/|com\/(invite|events)\/)(\w+)/ig;
  const matched = msg.cleanContent.match(inviteRegex);
  if (!matched) return null;

  const code = matched.map(m => ({
    event: /discord(app)?\.com\/events/i.test(m),
    code: m.replace(/(https?:\/\/)?discord(app)?\.(gg(\/invite)?\/|com\/(invite|events)\/)/, "")
  }));

  const filtered = code.filter(co => co.code !== msg.guild.id);
  if (filtered.length === 0) return null;

  const foundInvites = filtered.map(inv => inv.event ? msg.client.fetchGuildWidget(inv.code) : msg.client.fetchInvite(inv.code.trim()));
  try {
    const resolved = await Promise.all(foundInvites);
    return reportInvites(msg, matched, resolved);
  } catch (error) {
    if (["Unknown Invite", "Unknown Guild", "Widget Disabled"].includes(error?.message)) return reportInvites(msg, matched);
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
    if (processing.has(flag.id)) return interaction.reply({ content: "Someone is already processing this flag!", flags: ["Ephemeral"] });
    processing.add(flag.id);

    const mod = interaction.member;
    const embed = u.embed(flag.embeds[0]);
    const infraction = await u.db.infraction.getByFlag(flag.id);

    // Censor the flag with a description of the content (returns)
    if (interaction.customId === "modCardCensor") {
      // Get a description of the offense
      const modal = new u.Modal().addComponents(
        u.ModalActionRow().addComponents([
          new u.TextInput()
            .setCustomId("text")
            .setLabel("Replacement Text")
            .setStyle(Discord.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("A description of the content")
        ])
      ).setCustomId(`modalCensor${flag.id}`).setTitle("Censor Mod Card");

      await interaction.showModal(modal);
      const submitted = await interaction.awaitModalSubmit({ time: 5 * 60 * 1000, dispose: true }).catch(u.noop);
      if (!submitted) {
        interaction.editReply("I fell asleep waiting for your input...");
        return processing.delete(flag.id);
      }

      // Edit the embed to have the new description
      await submitted.deferUpdate();
      embed.data.fields = embed.data.fields?.filter(f => !f.name.startsWith("Matched"));
      embed.setDescription(submitted.fields.getTextInputValue("text"));
      submitted.editReply({ embeds: [embed], components: [] });

      return processing.delete(flag.id);
    }


    if (!infraction) {
      interaction.reply({ content: "I couldn't find that flag!", flags: ["Ephemeral"] });
      return processing.delete(flag.id);
    }

    // GET USER INFO (returns)
    if (interaction.customId === "modCardInfo") {
      // Don't count this as processing
      processing.delete(flag.id);

      await interaction.deferReply({ flags: ["Ephemeral"] });

      const member = await interaction.guild.members.fetch(infraction.discordId);
      let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
      if (roleString.length > 1024) roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + " ...";

      const userDoc = await u.db.user.fetchUser(member.id);
      if (!userDoc) return interaction.editReply("I couldn't find any info on them.");

      const e = await c.getSummaryEmbed(member);

      interaction.editReply({ embeds: [e] });
      return;
    }

    // LINK TO #MOD-DISCUSSION (returns)
    if (interaction.customId === "modCardLink") {
      const discussion = interaction.client.getTextChannel(u.sf.channels.mods.discussion);
      await interaction.reply({ content: `Sending the flag over to ${discussion}...`, flags: ["Ephemeral"] });

      embed.setFooter({ text: `Linked by ${u.escapeText(mod.displayName)}` });
      discussion?.send({ embeds: [embed] }).catch(u.noop);
      return processing.delete(flag.id);
    }

    // Prevent mods from handling their own flags (returns)
    if (infraction && mod.id === infraction.discordId) {
      await interaction.reply({ content: "You can't handle your own flag!", flags: ["Ephemeral"] });
      return processing.delete(flag.id);
    }

    // IGNORE FLAG (returns)
    if (interaction.customId === "modCardClear") {
      await interaction.deferUpdate();
      infraction.value = -1;
      infraction.handler = mod.id;

      await u.db.infraction.update(infraction);

      embed.setColor(c.colors.success)
        .addFields({ name: "Resolved", value: `${mod.toString()} cleared the flag.` });
      embed.data.fields = embed.data.fields?.filter(f => !f.name.startsWith("Reverted"));

      await interaction.editReply({ embeds: [embed], components: [c.revert] });
      return processing.delete(flag.id);
    }

    // RETRACT ACTION (returns)
    if (interaction.customId === "modCardRetract") {
      // Only the person who acted on the card (or someone in management) can retract an action
      if (infraction.handler !== mod.id && !u.perms.calc(interaction.member, ['mgmt'])) return interaction.reply({ content: "That isn't your card to retract!", flags: ["Ephemeral"] });

      // Update embed to reverted state
      await interaction.deferUpdate();
      const verbal = embed.data.fields?.find(f => f.value.includes("verbal"));
      const revertedMsg = "The offending message can't be restored." + (infraction.value > 9 ? " The Muted role may have to be removed and the user unwatched." : "");

      embed.setColor(c.colors.action)
        .setFields(embed.data.fields?.filter(f => !f.name.startsWith("Resolved") && !f.name.startsWith("Reverted")) ?? [])
        .addFields({ name: "Reverted", value: `${interaction.member} reverted the previous decision. ${infraction.value > 0 ? revertedMsg : ""}` });

      // Edit embed and inform user of result
      await interaction.editReply({ embeds: [embed], components: c.modActions });
      if (infraction.value > 0 || verbal) {
        await interaction.guild.members.cache.get(infraction.discordId)?.send(
          "## Moderation Update:"
          + "\nThe LDSG Mods have retracted their previous decision. It may be that they previously clicked the wrong button or are considering a different outcome."
          + "\nPlease be patient while the mods continue to review your case. If you don't hear anything soon from me or the mods, your case was likely cleared."
        );
      }

      // Update DB entry
      infraction.value = 0;
      infraction.handler = undefined;
      await u.db.infraction.update(infraction);
      return processing.delete(flag.id);
    }

    // ISSUE POINTS
    await interaction.deferUpdate();
    embed.setColor(c.colors.handled);
    infraction.handler = mod.id;
    const member = interaction.guild.members.cache.get(infraction.discordId);

    // Determine points
    switch (interaction.customId) {
      case "modCardVerbal":
        infraction.value = 0;
        embed.addFields({ name: "Resolved", value: `${mod} issued a verbal warning.` });
        break;
      case "modCardMinor":
        infraction.value = 1;
        embed.addFields({ name: "Resolved", value: `${mod} issued a 1 point warning.` });
        break;
      case "modCardMajor":
        infraction.value = 5;
        embed.addFields({ name: "Resolved", value: `${mod} issued a 5 point warning.` });
        break;
      case "modCardMute":
        infraction.value = 10;
        // Apply muted role and watch user
        if (!member) {
          // If they're not in the server, apply muted roles in the DB
          const roles = (await u.db.user.fetchUser(infraction.discordId))?.roles ?? [];
          roles.push(u.sf.roles.moderation.muted);

          await u.db.user.updateRoles(undefined, roles, infraction.discordId);
          await c.watch(interaction, infraction.discordId, true);
        } else if (!member.roles.cache.has(u.sf.roles.moderation.muted)) {
          // Only mute if they weren't already muted.
          try {
            await member.roles.add(u.sf.roles.moderation.muted);
            if (member.voice.channel) await member.voice.disconnect("Auto Mute").catch(u.noop);
            interaction.client.getTextChannel(u.sf.channels.mods.muted)?.send({
              content: `${member}, you have been muted in ${member.guild.name}. Please review our ${c.code}. A member of the mod team will be available to discuss more details.`,
              allowedMentions: { users: [member.id] }
            }).catch(u.noop);
          } catch (error) {
            u.errorHandler(error, "Mute user via card");
          }
        }

        embed.addFields({ name: "Resolved", value: `${mod} muted the member.` });
        break;
      default:
        u.errorHandler(new Error("Unhandled Mod Button Case"), interaction);
        return processing.delete(flag.id);
    }

    // Update DB entry
    await u.db.infraction.update(infraction);
    const infractionSummary = await u.db.infraction.getSummary(infraction.discordId);

    // Alert user of points
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

      member.send({ content: response, embeds: [quote] }).catch(() => c.blocked(member, "Infraction Warning"));
    }

    // Remove jump and reverted fields, update points
    const dummy = { value: "" };
    embed.data.fields = embed.data.fields?.filter(f => !f.name || !f.name.startsWith("Jump") && !f.name.startsWith("Reverted"));
    (embed.data.fields?.find(f => f.name?.startsWith("Infraction")) ?? dummy).value = `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}`;

    // Update flag
    await interaction.editReply({ embeds: [embed], components: [c.revert] }).catch(() => {
      interaction.message.edit({ embeds: [embed], components: [c.revert] }).catch((error) => u.errorHandler(error, interaction));
    });

    // Delete message
    if (infraction.value > 0) {
      const msg = await interaction.client.getTextChannel(infraction.channel ?? "")?.messages.fetch(infraction.message ?? "").catch(u.noop);
      u.clean(msg, 0);
    }

    processing.delete(flag.id);
  } catch (error) {
    u.errorHandler(error, interaction);
    processing.delete(interaction.message.id);
  }
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
  if (!int.customId.startsWith("modCard")) return;
  if (!u.perms.calc(int.member, ["mod", "mcMod", "mgr"])) {
    return int.reply({ content: "You don't have permissions to interact with this flag!", flags: ["Ephemeral"] });
  }
  processCardAction(int);
  return true;
})
// @ts-ignore it does exist...
.addEvent("filterUpdate", () => pf = new profanityFilter())
.setShared(() => pf)
.setClockwork(() => {
  // Clear spam list of old messages
  return setInterval(() => {
    for (const [id, activity] of active) {
      const relevantMessages = activity.messages.filter(m => Date.now() - m.createdTimestamp < config.spamThreshold.time);
      if (relevantMessages.length === activity.messages.length) continue;

      if (relevantMessages.length === 0) active.delete(id);
      else active.set(id, { id, messages: relevantMessages });
    }
  }, config.spamThreshold.time * 1000);
})
// @ts-ignore custom event
.addEvent("reloadBanned", () => {
  banned = c.getBanList();
  bannedWords = new RegExp(banned.words.join("|"), "i");

  linkFilters = {
    links: new RegExp(banned.links.join("|"), "gi"),
    scam: new RegExp(banned.scam.join("|"), "gi"),
    exception: new RegExp(banned.exception.join("|"), "gi"),
  };
})
.setUnload(() => c.grownups)
.setInit((grown) => grown ? c.grownups = grown : null);


module.exports = Module;