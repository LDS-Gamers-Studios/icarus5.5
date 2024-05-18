// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  profanityFilter = require("profanity-matcher"),
  c = require("../utils/modCommon");

const noTarget = "The user you provided was invalid. They may have left the server.";

/** @type {Map<string, any>} */
const molasses = new Map();

/** @param {Discord.Message} msg */
async function watch(msg) {
  if (!msg.inGuild()) return;

  if (
    msg.guild.id == u.sf.ldsg && // only LDSG
    !msg.system && !msg.webhookId && !msg.author.bot && // no bots
    msg.member && (!msg.member.roles.cache.has(u.sf.roles.trusted) || c.watchlist.has(msg.author.id)) // only untrusted, watched, and in the server
  ) {
    const files = msg.attachments.map(attachment => attachment.url)
      .concat(msg.stickers.map(s => s.url));
    const webhook = new Discord.WebhookClient({ url: config.webhooks.watchlist });
    const decorator = !msg.member?.roles.cache.has(u.sf.roles.trusted) ? "🚪" : "👀";
    webhook.send({
      content: `${msg.url} ${msg.editedAt ? "[EDITED]" : ""}\n> ${msg.content}`,
      files,
      username: `${decorator} - ${msg.member?.displayName ?? msg.author.displayName}`.substring(0, 31),
      avatarURL: msg.member?.displayAvatarURL() ?? msg.author.displayAvatarURL(),
      allowedMentions: { parse: [] }
    });
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashModWatch(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const apply = (interaction.options.getString("action") ?? "true") == "true";
  if (!target) return interaction.editReply(noTarget);

  const watching = await c.watch(interaction, target, apply);
  return interaction.editReply(watching);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModBan(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason", true);
  const days = interaction.options.getInteger("clean") ?? 1;
  if (!target) return interaction.editReply(noTarget);

  const ban = await c.ban(interaction, target, reason, days);
  return interaction.editReply(ban);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModFilter(interaction) {
  const pf = new profanityFilter();
  await interaction.deferReply({ ephemeral: true });

  const word = interaction.options.getString("word", true).toLowerCase().trim();
  const mod = interaction.member;
  const modLogs = interaction.client.getTextChannel(u.sf.channels.modlogs);
  const apply = (interaction.options.getString("action") ?? "true") == "true";

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
async function slashModSummary(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user") ?? interaction.member;
  const time = interaction.options.getInteger("history") ?? 28;

  const e = await c.getSummaryEmbed(member, time);
  return interaction.editReply({ embeds: [e] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModKick(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason", true);
  if (!target) return interaction.editReply(noTarget);

  const kick = await c.kick(interaction, target, reason);
  return interaction.editReply(kick);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModMute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const apply = (interaction.options.getString("action") ?? "true") == "true";
    const reason = interaction.options.getString("reason") || (apply ? "Violating the Code of Conduct" : "Case Closed");
    if (!target) return interaction.editReply(noTarget);

    const mute = await c.mute(interaction, target, reason, apply);
    return interaction.editReply(mute);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModNote(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user") ?? interaction.options.getUser("user", true);
    const note = interaction.options.getString("note", true);

    const noted = await c.note(interaction, target, note);
    return interaction.editReply(noted);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModOffice(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const apply = (interaction.options.getString("action") ?? "true") == "true";
    if (!target) return interaction.editReply(noTarget);

    const office = await c.office(interaction, target, reason, apply);
    return interaction.editReply(office);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModPurge(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const number = interaction.options.getInteger("number", true);
  const reason = interaction.options.getString("reason", true);
  const channel = interaction.channel;
  if (!channel) return interaction.editReply("Well that's awkward, I can't access the channel you're in!");
  if (number < 1) return interaction.editReply("You need to provide a number greater than 0.");
  const toDelete = await interaction.channel?.messages.fetch({ limit: Math.min(number, 100) });

  const deleted = await channel.bulkDelete(toDelete, true);
  // Log it
  interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
    u.embed({ author: interaction.member })
      .setTitle("Channel Purge")
      .setDescription(`**${interaction.member}** purged ${deleted.size} messages in ${interaction.channel}`)
      .addFields({ name: "Reason", value: reason })
      .setColor(c.colors.info)
  ] });

  return interaction.editReply(`I deleted ${deleted.size}/${toDelete.size} messages!`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModRename(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const newNick = interaction.options.getString("name") ?? c.nameGen();
  const reset = interaction.options.getBoolean("reset") ?? false;
  if (!target) return interaction.editReply(noTarget);

  const rename = await c.rename(interaction, target, newNick, reset);
  return interaction.editReply(rename);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModWatchlist(interaction) {
  await interaction.deferReply({ ephemeral: true });
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
  if (wlStr.length == 0) {
    wlStr = "Nobody is on the list!";
  }

  e.addFields({ name: 'Members', value: wlStr });

  return await interaction.editReply({ embeds: [e] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModSlowmode(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const duration = interaction.options.getInteger("duration") ?? 10;
  const delay = interaction.options.getInteger("delay") ?? 15;
  const indefinitely = interaction.options.getBoolean("indefinite") ?? false;
  const ch = interaction.channel;
  if (!ch) return interaction.editReply("I can't access the channel you're in!");

  if (duration == 0 || delay == 0) {
    await ch.setRateLimitPerUser(0).catch(e => u.errorHandler(e, interaction));
    const old = molasses.get(ch.id);
    if (old) {
      clearTimeout(old);
      molasses.delete(ch.id);
    }

    interaction.editReply("Slowmode deactivated.");
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
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

    const limit = prev ? prev.limit : ch.rateLimitPerUser;
    await ch.setRateLimitPerUser(delay);

    let durationStr = "indefinitely";

    if (duration > 0 && !indefinitely) {
      molasses.set(ch.id, {
        timeout: setTimeout((channel, rateLimitPerUser) => {
          channel.edit({ rateLimitPerUser }).catch(error => u.errorHandler(error, "Reset rate limit after slowmode"));
          molasses.delete(channel.id);
        }, duration * 60000, ch, limit),
        limit
      });
      durationStr = `for ${duration.toString()} minute${duration > 1 ? 's' : ''}`;
    }

    await interaction.editReply(`${delay}-second slowmode activated ${durationStr}.`);
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Slowmode")
      .setDescription(`${interaction.member} set a ${delay}-second slow mode ${durationStr} in ${ch}.`)
      .setColor(c.colors.info)
    ] });
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTrust(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const type = interaction.options.getString("type", true);
  const apply = (interaction.options.getString("action") ?? "true") == "true";
  if (!member) return interaction.editReply(noTarget);

  // evaluate and give appropriate trust level
  let trust = "";
  if (type == 'initial') trust = await c.trust(interaction, member, apply);
  else trust = await c.trustPlus(interaction, member, apply);
  return interaction.editReply(trust);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTimeout(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const time = interaction.options.getInteger("time") ?? 15;
  const reason = interaction.options.getString("reason");
  if (!member) return interaction.editReply(noTarget);

  // evaluate and give appropriate trust level
  const timeout = await c.timeout(interaction, member, time, reason ?? undefined);
  return interaction.editReply(timeout);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModWarn(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason", true);
  const value = interaction.options.getInteger("value") ?? 1;
  if (!member) return interaction.editReply(noTarget);

  const warn = await c.warn(interaction, reason, value, member);
  return interaction.editReply(warn);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModGrownups(interaction) {
  const time = Math.min(30, interaction.options.getInteger("time") ?? 15);
  if (!interaction.channel) return interaction.reply({ content: "Well that's awkward, I can't access the channel you're in!", ephemeral: true });
  if (interaction.channel.parent?.id != u.sf.channels.staffCategory) return interaction.reply({ content: "This command can only be used in the LDSG-Staff Category!", ephemeral: true });
  interaction.reply(time == 0 ? `*Whistles and wanders back in*` : `*Whistles and wanders off for ${time} minutes...*`);

  if (c.grownups.has(interaction.channel.id)) {
    clearTimeout(c.grownups.get(interaction.channel.id));
  }
  if (time == 0) {
    c.grownups.delete(interaction.channel.id);
  } else {
    c.grownups.set(interaction.channel.id, setTimeout((channel) => {
      c.grownups.delete(channel.id);
      channel.send("*I'm watching you again...* :eyes:");
    }, time * 60 * 1000, interaction.channel));
  }
}


const Module = new Augur.Module()
.addEvent("guildMemberAdd", async (member) => {
  if (member.guild.id == u.sf.ldsg) {
    try {
      const user = await u.db.user.fetchUser(member.id);
      if (!user || user.roles.includes(u.sf.roles.trusted)) return;
      const watchLog = member.client.getTextChannel(u.sf.channels.modWatchList);
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
.addEvent("messageCreate", watch)
.addEvent("messageUpdate", async (msg, newMsg) => {
  if (newMsg.partial) newMsg = await newMsg.fetch();
  watch(newMsg);
})
.addInteraction({
  name: "mod",
  guildId: u.sf.ldsg,
  id: u.sf.commands.slashMod,
  onlyGuild: true,
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
        default:
          u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
});

module.exports = Module;
