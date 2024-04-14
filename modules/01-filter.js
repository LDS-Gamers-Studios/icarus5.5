// @ts-check
const Augur = require("augurbot-ts"),
  banned = require("../data/banned.json"),
  Discord = require("discord.js"),
  config = require('../config/config.json'),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils"),
  p = require("../utils/perms"),
  c = require("../utils/modCommon");


const bannedWords = new RegExp(banned.words.join("|"), "i"),
  hasLink = /(>?(>?http[s]?|ftp):\/\/)?([\w.-]+\.)?([\w.-]+\.[^/\n ]+)(\/[^ \n]+)?/gi;

let pf = new profanityFilter();

/** @type {Set<string>} */
const processing = new Set();

// first value is for trusted, second is for non-trusted
const thresh = config.spamThreshold;

/**
 * @typedef activeMember
 * @prop {string} id
 * @prop {Discord.Message<true>[]} messages
 * @prop {number} [verdict]
 * @prop {number} [count]
 */
/** @type {Discord.Collection<string, activeMember> } */
const active = new u.Collection();

/** @param {Discord.Client} client*/
async function spamming(client) {
  // no point in doing it if nobodys posting
  if (active.size == 0) return;

  // get resources
  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  const trusted = ldsg?.roles.cache.get(u.sf.roles.trusted)?.members;

  // Get the limit for the type of verdict
  /** @param {string} type @param {string} id */
  const limit = (/** @type {"channels"|"messages"|"same"} */ type, id) => thresh[type][trusted?.has(id) ? 0 : 1];

  // Get verdicts for all active users and filter out unactioned ones
  const offending = active.map(activeMember => {
    let verdict = 0;

    // Count how many of the same messages they've sent
    /** @type {Discord.Collection<string, {content: string, count: number}>} */
    const sameMessages = new u.Collection();
    for (const message of activeMember.messages) {
      const prev = sameMessages.get(message.content.toLowerCase());
      sameMessages.set(message.content.toLowerCase(), { content: message.content.toLowerCase(), count: (prev?.count ?? 0) + 1 });
    }

    // See what channels they've been posting in
    const channels = u.unique(activeMember.messages.map(m => m.channelId)).length;

    // Decide verdict
    if (limit('same', activeMember.id) <= Math.max(...sameMessages.map(m => m.count))) verdict = 3;
    else if (limit('channels', activeMember.id) <= channels) verdict = 1;
    else if (limit('messages', activeMember.id) <= activeMember.messages.length) verdict = 2;

    // Set verdict
    activeMember.verdict = verdict;
    activeMember.count = [null, channels, activeMember.messages.length, sameMessages.reduce((a, b) => a + b.count, 0)][verdict] ?? undefined;
    return activeMember;
  }).filter(a => a.verdict && a.verdict != 0);

  for (const member of offending) {
    const message = member.messages[0];
    /** @type {Discord.Collection<string, {channel: string, count: number}>} */
    const channels = new u.Collection();
    for (const msg of member.messages) {
      const prev = channels.get(msg.channelId);
      channels.set(msg.channelId, { channel: msg.channel.toString(), count: (prev?.count ?? 0) + 1 });
    }

    const verdictString = [
      null,
      `Posted in too many channels (${member.count}/${limit('channels', member.id)}) too fast\nChannels:\n${channels.map(ch => `${ch.channel} (${ch.count})`).join('\n')}`,
      `Posted too many messages (${member.count}/${limit('messages', member.id)}) too fast\nChannels:\n${channels.map(ch => `${ch.channel} (${ch.count})`).join('\n')}`,
      `Posted the same message too many times (${member.count}/${limit('same', member.id)})`,
    ];
    if (!ldsg) return;
    const cleaned = await c.spamCleanup(member.messages.map(m => m.content.toLowerCase()), ldsg, message, true);
    const flag = await c.createFlag({ msg: message, member: message.member ?? message.author, snitch: client.user?.toString(), flagReason: verdictString[member.verdict ?? 1] + "\nThere may be additional spammage that I didn't catch.", pingMods: member.verdict == 3 });
    if (cleaned.notDeleted) {
      const embed = flag?.embeds[0] ?? { fields: [{ name: "", value: "" }] };
      embed.fields.push({ name: "Further Information", value: `I couldn't delete some of the messages, but I managed to get ${cleaned.deleted}/${cleaned.toDelete} of all their spammed messages` });
      await flag?.edit({ embeds: [embed] });
    }
    active.delete(member.id);
  }
}

/**
 * Filter some text, warn if appropriate.
 * @param {Discord.Message} msg The message the text is associated with.
 * @param {String} text The text to scan.
 */
function filter(msg, text) {
  // PROFANITY FILTER
  const noWhiteSpace = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~"'()?|]/g, "").replace(/\s\s+/g, " ");
  const filtered = pf.scan(noWhiteSpace);
  if ((filtered.length > 0) && filtered[0] && (noWhiteSpace.length > 0)) {
    c.createFlag({ msg, member: msg.member ?? msg.author, matches: filtered, flagReason: "Profanity detected" });
    return true;
  } else { return false; }
}

/**
 * Process discord message language
 * @param {Discord.Message} msg Message
 */
function processMessageLanguage(msg) {
  if (!msg.inGuild() || msg.guild.id != u.sf.ldsg || msg.channel.id == u.sf.channels.modWatchList) return;
  // catch spam
  if (!msg.author.bot && !msg.webhookId && !c.grownups.has(msg.channel.id)) {
    const messages = active.get(msg.author.id)?.messages ?? [];
    messages.push(msg);
    active.set(msg.author.id, { id: msg.author.id, messages: messages });
  }

  processDiscordInvites(msg);

  if (c.grownups.has(msg.channel.id)) return;

  /** @param {string} prop @param {{tld: string | undefined, url: string}} l */
  const linkFilter = (prop, l) => new RegExp(banned[prop].join('|'), 'gi').test(linkMap(l));

  /** @param {{tld: string | undefined, url: string}} l */
  const linkMap = (l) => (l.tld ?? "") + l.url;

  // LINK FILTER
  let link = null;
  /** @type {Discord.Collection<string, {tld: string | undefined, url: string}>} */
  const matchedLinks = new u.Collection();
  let matchedWords = null;
  while ((link = hasLink.exec(msg.cleanContent)) != null) {
    matchedLinks.set((link[3] ?? "") + link[4], { tld: link[3], url: link[4] });
  }
  if (matchedLinks.size > 0) {
    const bannedLinks = matchedLinks.filter(l => linkFilter("links", l)).map(linkMap);
    const scamLinks = matchedLinks.filter(l => linkFilter("scam", l)).filter(l => !linkFilter("exception", l)).map(linkMap);
    if (bannedLinks.length > 0) {
      // Naughty Links
      c.createFlag({ msg, member: msg.member ?? msg.author, matches: bannedLinks, pingMods: true, flagReason: "Dangerous Link" });
      return true;
    } else if (scamLinks.length > 0) {
      // Scam Links
      u.clean(msg, 0);
      msg.reply({ content: "That link is generally believed to be a scam/phishing site. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member ?? msg.author, matches: scamLinks, flagReason: "Suspected scam links (Auto-Removed)" });
      return true;
    } else if (bannedWords.exec(msg.cleanContent) && matchedLinks.find(l => l.url.includes("tenor") || l.url.includes("giphy"))) {
      // Bad gif link
      u.clean(msg, 0);
      msg.reply({ content: "Looks like that link might have some harsh language. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member ?? msg.author, matches: matchedLinks.map(l => (l.tld ?? "") + l.url), flagReason: "Gif Link Language (Auto-Removed)" });
      return true;
    } else if (!msg.webhookId && !msg.author.bot && msg.member && !msg.member.roles.cache.has(u.sf.roles.trusted)) {
      // General untrusted link flag
      c.createFlag({ msg, member: msg.member, matches: matchedLinks.map(l => (l.tld ?? "") + l.url), flagReason: "Links prior to being trusted" });
    }
  }

  // HARD LANGUAGE FILTER
  if (matchedWords = msg.cleanContent.match(bannedWords)) {
    c.createFlag({ msg, member: msg.member ?? msg.author, matches: matchedWords, pingMods: true, flagReason: "Automute word detected" });
    c.watch(msg, msg.member ?? msg.author.id, true);
    return true;
  }

  // SOFT LANGUAGE FILTER
  filter(msg, msg.cleanContent);

  // LINK PREVIEW FILTER
  if (msg.author.id == msg.client.user.id) return; // ignore icarus because he's infallable... right? (no but it'll flag its own logs)
  for (const embed of msg.embeds) {
    const preview = [embed.author?.name ?? "", embed.title ?? "", embed.description ?? ""].join("\n").toLowerCase();
    const previewBad = preview.match(bannedWords) ?? [];
    if (previewBad.length > 0) {
      if (!msg.author.bot) msg.reply({ content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member ?? msg.author, matches: previewBad, flagReason: "Link preview language (Auto-Removed)" });
      u.clean(msg, 0);
      break;
    }
    if (filter(msg, preview)) {
      if (!msg.author.bot) msg.reply({ content: "It looks like that link might have some language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
      msg.suppressEmbeds().catch(u.noop);
      break;
    }
  }
}

/**
 * Report on the posted invite
 * @param {Discord.Invite[]} [invites]
 * @param {string[]} rawInvites
 * @param {Discord.Message} msg
 */
function reportInvites(msg, rawInvites, invites) {
  /** @type {string[]} */
  let external = [];
  if (invites && (invites.length > 0)) {
    external = invites.filter(i => i.guild?.id != u.sf.ldsg).map(i => {
      return `Guild: ${i.guild?.name ?? "Unknown"}, Channel: ${i.channel?.name ?? "Unknown"}`;
    });
  } else {
    external = rawInvites.filter(i => !i.endsWith("ldsg")).map(() => "Guild: Unknown, Channel: Unknown");
  }
  if (external.length > 0) {
    if (msg.webhookId || msg.author.bot) {
      for (const invite of rawInvites) msg.content = msg.content.replace(invite, "[Discord Invite]");
      u.clean(msg, 0);
      const embed = u.embed({ author: msg.author }).setDescription(msg.content);
      msg.channel.send({ embeds: [embed, ...msg.embeds], files: Array.from(msg.attachments.values()) });
      return;
    }
    c.createFlag({ msg, member: msg.member ?? msg.author, matches: external.join("\n"), flagReason: "Automatic Discord invite removal" });
    u.clean(msg, 0);
    msg.channel.send({ embeds: [
      u.embed({
        description: "It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages."
      })
    ] })
    .then(u.clean);
  }
}

/**
 * Process Discord invites
 * @param {Discord.Message} msg Original message
 */
async function processDiscordInvites(msg) {
  const bot = msg.client;
  const inviteRegex = /(https?:\/\/)?discord(app)?\.(gg(\/invite)?\/|com\/invite\/)(\w+)/ig;
  let matched = null;
  if (matched = msg.cleanContent.match(inviteRegex)) {
    const foundInvites = matched.map(inv => bot.fetchInvite(inv.trim()));

    Promise.all(foundInvites).then((i) => reportInvites(msg, matched, i)).catch(e => {
      if (e && e.message == "Unknown Invite") {
        reportInvites(msg, matched);
      } else { u.errorHandler(e, msg); }
    });
  }
}

/**
 * Process the warning card
 * @async
 * @function processCardAction
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
    if (!infraction) {
      interaction.reply({ content: "I couldn't find that flag!", ephemeral: true });
      return processing.delete(flag.id);
    }
    if (mod.id == infraction.discordId) {
      await interaction.reply({ content: "You can't handle your own flag!", ephemeral: true });
      return processing.delete(flag.id);
    }

    if (interaction.customId == "modCardInfo") {
      await interaction.deferReply({ ephemeral: true });
      // Don't count this as processing
      processing.delete(flag.id);
      const member = await interaction.guild.members.fetch(infraction.discordId);
      let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
      if (roleString.length > 1024) roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + " ...";

      const userDoc = await u.db.user.fetchUser(member.id);
      if (!userDoc) return interaction.editReply("I couldn't find any info on them.");

      const e = await c.getSummaryEmbed(member);

      interaction.editReply({ embeds: [e] });
      return;
    } else if (interaction.customId == "modCardClear") {
      // IGNORE FLAG
      await interaction.deferUpdate();
      infraction.value = -1;
      infraction.handler = mod.id;
      await u.db.infraction.update(infraction);
      embed.setColor(0x00FF00)
        .addFields({ name: "Resolved", value: `${mod.toString()} cleared the flag.` });
      embed.data.fields = embed.data.fields?.filter(f => !f.name.startsWith("Reverted"));
      await interaction.editReply({ embeds: [embed], components: [c.revert] });
    } else if (interaction.customId == "modCardLink") {
      // LINK TO #MODDISCUSSION
      const md = interaction.client.getTextChannel(u.sf.channels.moddiscussion);
      await interaction.reply({ content: `Sending the flag over to ${md}...`, ephemeral: true });

      embed.setFooter({ text: `Linked by ${u.escapeText(mod.displayName)}` });
      md?.send({ embeds: [embed] }).catch(u.noop);
    } else if (interaction.customId == "modCardRetract") {
      // Only the person who acted on the card (or someone in management) can retract an action
      if (infraction.handler != mod.id && !p.calc(interaction.member, ['mgmt'])) return interaction.reply({ content: "That isn't your card to retract!", ephemeral: true });
      await interaction.deferUpdate();
      const verbal = embed.data.fields?.find(f => f.value.includes("verbal"));
      const revertedMsg = "The offending message can't be restored" + (infraction.value > 9 ? " and the Muted role may have to be removed and the user unwatched." : ".");
      embed.setColor(0xFF0000)
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
    } else {
      await interaction.deferUpdate();
      embed.setColor(0x0000FF);
      infraction.handler = mod.id;
      const member = interaction.guild.members.cache.get(infraction.discordId);

      switch (interaction.customId) {
      case "modCardVerbal":
        infraction.value = 0;
        embed.setColor(0x00FFFF).addFields({ name: "Resolved", value: `${mod.toString()} issued a verbal warning.` });
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
      }
      await u.db.infraction.update(infraction);
      const infractionSummary = await u.db.infraction.getSummary(infraction.discordId);

      if (member && infraction.channel) {
        const quote = u.embed({ author: member })
          .addFields({ name: "Channel", value: `#${interaction.client.getTextChannel(infraction.channel)?.name ?? "Unknown Channel"}` })
          .setDescription(embed.data.description ?? null)
          .setTimestamp(flag.createdAt);

        const response = "## 🚨 Message from the LDSG Mods:\n" + (
          (infraction.value == 0) ?
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
.addEvent("messageUpdate", async (old, newMsg) => {
  if (newMsg.partial) newMsg = await newMsg.fetch();
  processMessageLanguage(newMsg);
})
.addEvent("interactionCreate", (int) => {
  if (!int.inCachedGuild() || !int.isButton()) return;
  if (!p.calc(int.member, ["mod"])) {
    int.reply({ content: "You don't have permissions to interact with this flag!", ephemeral: true });
    return;
  }
  if (['clear', 'verbal', 'minor', 'major', 'mute', 'info', 'link', 'retract'] // mod card actions minus the modCard part
    .includes(int.customId.replace("modCard", "").toLowerCase())) return processCardAction(int);
})
// @ts-ignore
.addEvent("filterUpdate", () => pf = new profanityFilter())
.addEvent("ready", () => {
  setInterval(() => {
    spamming(Module.client);
    for (const [id, member] of active) {
      const newMsgs = member.messages.filter(m => m.createdTimestamp + (thresh.time * 1000) >= Date.now());
      if (newMsgs.length === member.messages.length) continue;
      if (newMsgs.length == 0) active.delete(id);
      else active.set(id, Object.assign(member, { messages: newMsgs }));
    }
  }, thresh.time * 1000);
})
.setUnload(() => c.grownups)
.setInit((grown) => grown ? c.grownups = grown : null);


module.exports = Module;
