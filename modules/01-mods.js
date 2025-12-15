// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  c = require("../utils/modCommon"),
  Module = new Augur.Module();

const noTarget = "The user you provided was invalid. They may have left the server.";

/** @type {Map<string, { limit: number, timeout: NodeJS.Timeout }>} */
const molasses = new Map();

/**
 * @param {Discord.GuildMember} member
 * @param {string} webhookURL
 * @param {string} decorator
 * @param {string} [content]
 * @param {Discord.Message} [msg]
*/
function sendMsgCopy(member, webhookURL, decorator, content, msg) {

  if (!content && msg) {
    content = `${msg.url} ${msg.editedAt ? "[EDITED]" : ""}\n> ${msg.content}`;
  }

  /** @type {Discord.WebhookMessageCreateOptions} */
  const payload = {
    username: `${decorator} - ${member.displayName}`.substring(0, 31),
    avatarURL: member.displayAvatarURL(),
    allowedMentions: { parse: [] },
    content,
    files: msg ? msg.attachments.map(attachment => attachment.url).concat(msg.stickers.map(s => s.url)) : undefined
  };

  const webhook = new Discord.WebhookClient({ url: webhookURL });

  webhook.send(payload);

}

/**
 * @param {Discord.Message} [msg]
 * @param {Discord.VoiceState} [oldState]
 * @param {Discord.VoiceState} [newState]
 */
async function watch(msg, oldState, newState) {
  const guild = msg?.guild || oldState?.guild || newState?.guild;
  const member = msg?.member || oldState?.member || newState?.member;
  if (!guild || !member || guild.id !== u.sf.ldsg) return; // make sure vars are defined and in a server;
  if (msg && (msg.system || msg.webhookId)) return; // no bot messages
  if (member.user.bot || (member.roles.cache.has(u.sf.roles.moderation.trusted) && !c.watchlist.has(member.id))) return; // filter not in the watchlist

  const decorator = !member.roles.cache.has(u.sf.roles.moderation.trusted) ? "🚪" : "👀";

  let content = "";

  if (!msg && oldState?.channelId !== newState?.channelId) {
    if (newState?.channel) content = `🎙️ Joined ${newState.channel.name}`;
    else if (oldState?.channel) content = `🔇 Left ${oldState.channel.name}`;
  }

  sendMsgCopy(member, config.webhooks.watchlist, decorator, content, msg);
}

/** @param {Discord.Message<true>} msg */
async function mutedHistory(msg) {
  if (!msg.member || ![u.sf.channels.mods.muted, u.sf.channels.mods.office].includes(msg.channelId)) return;

  const isOffice = msg.channelId === u.sf.channels.mods.office;
  const webhook = isOffice ? config.webhooks.officeHistory : config.webhooks.mutedHistory;

  let decorator = "🛡️";
  if (msg.member.roles.cache.hasAny(u.sf.roles.moderation.muted, u.sf.roles.moderation.ductTape)) {
    if (isOffice) decorator = "🪑";
    else decorator = "🔇";
  }

  const content = `${msg.editedAt ? "[EDITED]" : ""} ${msg.content}`;
  sendMsgCopy(msg.member, webhook, decorator, content, msg);
}

/** @typedef {string | { payload: Discord.InteractionEditReplyOptions | string, interaction: Discord.ChatInputCommandInteraction<"cached"> | Discord.ButtonInteraction} | null} ModActionReturn */
/**
 * Handles most commands that use mod-common functions that target a specific user
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction
 * @param {(interaction: Augur.GuildInteraction<"CommandSlash">, member: Discord.GuildMember) => Promise<ModActionReturn>} fn
*/
async function targetedModAction(interaction, fn) {
  try {
    await interaction.deferReply({ flags: u.ephemeralChannel(interaction, u.sf.channels.mods.discussion) });
    const target = interaction.options.getMember("user");
    if (!target) return interaction.editReply(noTarget);

    const result = await fn(interaction, target);
    if (!result) return;

    if (typeof result === "string") return interaction.editReply(result);
    return result.interaction.editReply(result.payload);
  } catch (error) {
    u.errorHandler(error, interaction);
  }
}


/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModSummary(interaction) {
  await interaction.deferReply({ flags: u.ephemeralChannel(interaction, u.sf.channels.mods.discussion) });
  const member = interaction.options.getMember("user") ?? interaction.member;
  const time = interaction.options.getInteger("history") ?? 28;

  const e = await c.getSummaryEmbed(member, time);
  return interaction.editReply({ embeds: [e] });
}


/*******************************
 * BASIC TARGETED MOD COMMANDS *
 *******************************/

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashModWatch(interaction) {
  const apply = (interaction.options.getString("action") ?? "true") === "true";
  targetedModAction(interaction, (i, m) => c.watch(i, m, apply));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModBan(interaction) {
  const reason = interaction.options.getString("reason", true);
  const days = interaction.options.getInteger("clean") ?? 1;

  targetedModAction(interaction, (i, m) => c.ban(i, m, reason, days));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModKick(interaction) {
  const reason = interaction.options.getString("reason", true);

  targetedModAction(interaction, (i, m) => c.kick(i, m, reason));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModMute(interaction) {
  const apply = (interaction.options.getString("action") ?? "true") === "true";
  const reason = interaction.options.getString("reason") || (apply ? "Violating the Code of Conduct" : "Case Closed");

  targetedModAction(interaction, (i, m) => c.mute(i, m, reason, apply));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModNote(interaction) {
  const note = interaction.options.getString("note", true);

  targetedModAction(interaction, (i, m) => c.note(i, m, note));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModOffice(interaction) {
  const reason = interaction.options.getString("reason") || "No reason provided";
  const apply = (interaction.options.getString("action") ?? "true") === "true";

  targetedModAction(interaction, (i, m) => c.office(i, m, reason, apply));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModRename(interaction) {
  const newNick = interaction.options.getString("name") ?? c.nameGen();
  const reset = interaction.options.getBoolean("reset") ?? false;

  targetedModAction(interaction, (i, m) => c.rename(i, m, newNick, reset));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTrust(interaction) {
  const type = interaction.options.getString("type", true);
  const apply = (interaction.options.getString("action") ?? "true") === "true";

  if (type === "initial") targetedModAction(interaction, (i, m) => c.trust(i, m, apply));
  else targetedModAction(interaction, (i, m) => c.trustPlus(i, m, apply));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTimeout(interaction) {
  const time = interaction.options.getInteger("time") ?? 15;
  const reason = interaction.options.getString("reason") ?? undefined;

  targetedModAction(interaction, (i, m) => c.timeout(i, m, time, reason));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModWarn(interaction) {
  const reason = interaction.options.getString("reason", true);
  const value = interaction.options.getInteger("value") ?? 1;

  targetedModAction(interaction, (i, m) => c.warn(i, reason, value, m));
}

/************************************
 * MOD SUMMARY/MORE GLOBAL COMMANDS *
 ************************************/

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModSlowmode(interaction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });

  const duration = interaction.options.getInteger("duration") ?? 10;
  const delay = interaction.options.getInteger("delay") ?? 15;
  const reason = interaction.options.getString("reason", true);

  const ch = interaction.channel;
  if (!ch) return interaction.editReply("I can't access the channel you're in!");

  if (duration === 0 || delay === 0) {
    await ch.setRateLimitPerUser(0).catch(e => u.errorHandler(e, interaction));
    const old = molasses.get(ch.id);
    if (old) {
      clearTimeout(old.timeout);
      molasses.delete(ch.id);
    }

    interaction.editReply("Slowmode deactivated.");
    await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
      u.embed({ author: interaction.member })
        .setTitle("Channel Slowmode")
        .setDescription(`${interaction.member} disabled slowmode in ${ch}`)
        .setColor(c.colors.info)
        .setFooter({ text: old ? "Back to normal!" : "It's possible that the bot ran into an error while automatically resetting" })
    ] });
  } else {
    // Reset duration if already in slowmode
    const prev = molasses.get(ch.id);
    if (prev) clearTimeout(prev.timeout);

    const limit = prev ? prev.limit : ch.rateLimitPerUser ?? 0;
    await ch.send(`Let's slow down for a bit.\nReason: ${reason}`).catch(u.noop);
    await ch.setRateLimitPerUser(delay);

    molasses.set(ch.id, {
      timeout: setTimeout((channel, rateLimitPerUser) => {
        channel.edit({ rateLimitPerUser }).catch(error => u.errorHandler(error, "Reset rate limit after slowmode"));
        molasses.delete(channel.id);
      }, duration * 60000, ch, limit),
      limit
    });

    const durationStr = `for ${duration.toString()} minute${duration > 1 ? 's' : ''}`;
    await interaction.editReply(`${delay}-second slowmode activated ${durationStr}.`);
    await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Slowmode")
      .setDescription(`${interaction.member} set a ${delay}-second slow mode ${durationStr} in ${ch}.`)
      .setColor(c.colors.info)
    ] });
  }
}


/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModPurge(interaction) {
  await interaction.deferReply({ flags: ["Ephemeral"] });
  const number = interaction.options.getInteger("number", true);
  const reason = interaction.options.getString("reason", true);
  const channel = interaction.channel;

  if (!channel) return interaction.editReply("Well that's awkward, I can't access the channel you're in!");
  if (number < 1) return interaction.editReply("You need to provide a number greater than 0.");

  const toDelete = await interaction.channel?.messages.fetch({ limit: Math.min(number, 100) }).catch(() => {
    interaction.editReply("I couldn't get the messages in that channel. Sorry!");
  });

  if (!toDelete) return;

  const deleted = await channel.bulkDelete(toDelete, true);
  // Log it
  interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
    u.embed({ author: interaction.member })
      .setTitle("Channel Purge")
      .setDescription(`**${interaction.member}** purged ${deleted.size} messages in ${interaction.channel}`)
      .addFields({ name: "Reason", value: reason })
      .setColor(c.colors.info)
  ] });

  return interaction.editReply(`I deleted ${deleted.size}/${toDelete.size} messages!`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModFilter(interaction) {
  /** @type {import("profanity-matcher") | undefined} */
  const pf = interaction.client.moduleManager.shared.get("01-filter.js")?.();
  if (!pf) throw new Error("Couldn't access profanity filter");

  await interaction.deferReply({ flags: ["Ephemeral"] });

  const word = interaction.options.getString("word", true).toLowerCase().trim();
  const mod = interaction.member;
  const modLogs = interaction.client.getTextChannel(u.sf.channels.mods.logs);
  const apply = (interaction.options.getString("action") ?? "true") === "true";

  const filtered = pf.scan(word);
  if (!u.perms.calc(interaction.member, ["mgr"])) {
    return interaction.editReply("This command is for Managers+ only.");
  }

  if (apply) {
    if (!filtered.includes(word) && pf.add_word(word)) {
      const embed = u.embed({ author: mod })
        .setTitle("Word added to the language filter.")
        .setDescription(`${mod} added "${word}" to the language filter.`);
      modLogs?.send({ embeds: [embed] });
      await interaction.editReply(`"${word}" was added to the language filter.`);
    } else {
      await interaction.editReply(`"${word}" was already in the language filter.`);
    }
  } else if (pf.remove_word(word)) {
    Module.client.emit("filterUpdate"); // prevent flagging of embed saying it was removed
    const embed = u.embed({ author: mod })
      .setTitle("Word removed from language filter.")
      .setDescription(`${mod} removed "${word}" from the language filter.`);
    modLogs?.send({ embeds: [embed] });
    await interaction.editReply(`"${word}" has been removed from the language filter.`);
  } else {
    await interaction.editReply(`"${word}" was not found in the language filter.`);
  }
  return Module.client.emit("filterUpdate");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTrustAudit(interaction) {
  try {
    await interaction.deferReply({ flags: u.ephemeralChannel(interaction, u.sf.channels.mods.discussion) });
    const threshold = interaction.options.getInteger("posts", false) ?? 100;

    const members = interaction.guild.members.cache;
    const pool = members.filter(member => ((Date.now() - (member.joinedTimestamp || 0)) > (7 * 24 * 60 * 60_000)) && !member.roles.cache.has(u.sf.roles.moderation.trusted));
    const users = await u.db.user.getUsers({ posts: { $gt: threshold }, discordId: { $in: pool.map(m => m.id) } });

    const response = users.sort((a, b) => b.posts - a.posts)
      .map(m => {
        const member = members.get(m.discordId);
        return `${member || `<@${m.discordId}>`}: ${m.posts} posts, joined ${member?.joinedAt?.toDateString() || "at an unkown date" } `;
      });

    if (response.length === 0) return interaction.editReply(`No untrusted users who have been in the server longer than a week with ${threshold}+ posts found.`);

    const embed = u.embed().setTitle("Trust Audit").setDescription("All of the people that have talked without the trusted role");
    const processedEmbeds = u.pagedEmbedsDescription(embed, response);

    return u.manyReplies(interaction, processedEmbeds.map(a => ({ embeds: [a] })));
  } catch (e) {
    u.errorHandler(e, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModWatchlist(interaction) {
  await interaction.deferReply({ flags: u.ephemeralChannel(interaction, u.sf.channels.mods.discussion) });
  c.watchlist = new Set((await u.db.user.getUsers({ watching: true })).map(usr => usr.discordId));

  const e = u.embed({ author: interaction.member })
    .setTitle("Watchlist")
    .setDescription(`List of those who are trusted but watched.`)
    .setColor(c.colors.info);

  let wlStr = "";
  for (const member of c.watchlist) {
    const user = interaction.guild.members.cache.get(member);
    if (!user) continue;
    wlStr += `${user}\n`;
  }

  e.addFields({ name: 'Members', value: wlStr || "Nobody is on the list!" });

  return await interaction.editReply({ embeds: [e] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModGrownups(interaction) {
  const time = Math.min(30, interaction.options.getInteger("time") ?? 15);
  if (!interaction.channel) return interaction.reply({ content: "Well that's awkward, I can't access the channel you're in!", flags: ["Ephemeral"] });
  if (interaction.channel.parent?.id !== u.sf.channels.team.category) return interaction.reply({ content: "This command can only be used in the LDSG-Staff Category!", flags: ["Ephemeral"] });
  interaction.reply(time === 0 ? `*Whistles and wanders back in*` : `*Whistles and wanders off for ${time} minutes...*`);

  if (c.grownups.has(interaction.channel.id)) {
    clearTimeout(c.grownups.get(interaction.channel.id));
  }
  if (time === 0) {
    c.grownups.delete(interaction.channel.id);
  } else {
    c.grownups.set(interaction.channel.id, setTimeout((channel) => {
      c.grownups.delete(channel.id);
      channel.send("*I'm watching you again...* :eyes:");
    }, time * 60 * 1000, interaction.channel));
  }
}

/** @param {Discord.ButtonInteraction<"cached">} interaction */
async function buttonModUnmutePurge(interaction) {
  if (!interaction.channel) throw new Error("Unable to access channel");

  if (![u.sf.channels.mods.office, u.sf.channels.mods.muted].includes(interaction.channel?.id ?? "")) {
    u.errorHandler(new Error("Unmute purge button attempted outside of mute channel"), interaction);
    return interaction.reply({ content: "You can't use that in this channel!", flags: ["Ephemeral"] });
  }

  await interaction.deferReply({ flags: ["Ephemeral"] });

  let messages = await interaction.channel.bulkDelete(100, false);
  while (messages.size === 100) {
    messages = await interaction.channel.bulkDelete(100, false);
  }

  await interaction.editReply("Channel was cleaned up!");
}


Module.addEvent("guildMemberAdd", async (member) => {
  if (member.guild.id === u.sf.ldsg) {
    try {
      const user = await u.db.user.fetchUser(member.id);
      if (!user || user.roles.includes(u.sf.roles.moderation.trusted)) return;
      const watchLog = member.client.getTextChannel(u.sf.channels.mods.watchList);
      const embed = u.embed({ author: member })
        .setColor(c.colors.info)
        .setTitle("New Member 👀")
        .setDescription(` ${member} has been automatically added to the watch list.\nUse </mod trust:${u.sf.commands.slashMod}> to remove them.`);
      watchLog?.send({ embeds: [embed] });
    } catch (e) { u.errorHandler(e, "Watchlist Auto-Add"); }
  }
})
.setInit(async () => {
  const list = await u.db.user.getUsers({ watching: true });
  c.watchlist = new Set(list.map(l => l.discordId));
})
.addEvent("messageCreate", (msg) => {
  if (!msg.inGuild()) return;
  watch(msg);
  mutedHistory(msg);
})
.addEvent("messageEdit", async (msg, newMsg) => {
  if (!newMsg.inGuild()) return;
  watch(newMsg);
  mutedHistory(newMsg);
})
.addEvent("voiceStateUpdate", (oldS, newS) => {
  watch(undefined, oldS, newS);
})
.addInteraction({
  name: "mod",
  guildId: u.sf.ldsg,
  id: u.sf.commands.slashMod,
  onlyGuild: true,
  options: { registry: "slashMod" },
  permissions: (int) => u.perms.calc(int.member, ["mod", "mgr"]),
  process: (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
        case "ban": return slashModBan(interaction);
        case "filter": return slashModFilter(interaction);
        case "kick": return slashModKick(interaction);
        case "mute": return slashModMute(interaction);
        case "note": return slashModNote(interaction);
        case "office": return slashModOffice(interaction);
        case "purge": return slashModPurge(interaction);
        case "rename": return slashModRename(interaction);
        case "slowmode": return slashModSlowmode(interaction);
        case "watchlist": return slashModWatchlist(interaction);
        case "summary": return slashModSummary(interaction);
        case "trust": return slashModTrust(interaction);
        case "timeout": return slashModTimeout(interaction);
        case "warn": return slashModWarn(interaction);
        case "watch": return slashModWatch(interaction);
        case "grownups": return slashModGrownups(interaction);
        case "trustaudit": return slashModTrustAudit(interaction);
        default:
          u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
})
.addInteraction({
  name: "modUnmutePurge",
  id: "modUnmutePurge",
  type: "Button",
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mod"]),
  process: buttonModUnmutePurge,
});

module.exports = Module;
