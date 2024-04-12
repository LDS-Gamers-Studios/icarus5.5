// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  p = require("../utils/perms"),
  profanityFilter = require("profanity-matcher"),
  c = require("../utils/modCommon");

/** @type {Set<string>} */
let watchlist = new Set();
const noTarget = "You need to provide a user!";

const Module = new Augur.Module()
.addEvent("guildMemberAdd", async (member) => {
  if (member.guild.id == u.sf.ldsg) {
    try {
      const user = await u.db.user.fetchUser(member.id);
      if (!user || user.roles.includes(u.sf.roles.trusted)) return;
      const watchLog = member.client.getTextChannel(u.sf.channels.modlogsplus);
      watchLog?.send(`ℹ️ **${member.displayName}** has been automatically added to the watch list. Use the \`\\mod trust @user(s)\` command to remove them.`);
    } catch (e) { u.errorHandler(e, "Watchlist Auto-Add"); }
  }
})
.addEvent("ready", async () => {
  const list = await u.db.user.getUsers({ watching: true });
  watchlist = new Set(list.map(l => l.discordId));
})
.addEvent("messageCreate", watch)
.addEvent("messageUpdate", async (msg, newMsg) => {
  if (newMsg.partial) newMsg = await newMsg.fetch();
  watch(newMsg);
});

/**
 * @param {Discord.Message} msg
 */
async function watch(msg) {
  if (!msg.guild) return;
  const watchLog = msg.client.getTextChannel(u.sf.channels.modlogsplus);

  if (
    msg.guild.id == u.sf.ldsg && // only LDSG
    !msg.system && !msg.webhookId && !msg.author.bot && // no bots
    (!msg.member?.roles.cache.has(u.sf.roles.trusted) || watchlist.has(msg.author.id)) // only untrusted and watched
  ) {
    const files = msg.attachments.map(attachment => attachment.url);
    watchLog?.send(`**${msg.member?.displayName || msg.author?.username}** in ${msg.channel}:\n>>> ${msg.cleanContent}`);
    if (files.length > 0) {
      watchLog?.send({ files: files });
    }
  }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction
 * @param {Discord.GuildMember} target
 */
async function modWatch(interaction, target) {
  if (watchlist.has(target.id)) return interaction.editReply(`${target} was already on the watchlist.`);

  await u.db.user.updateWatch(target.id, true);
  const watchLog = interaction.client.getTextChannel(u.sf.channels.modlogs);
  watchlist.add(target.id);

  interaction.editReply(`I'm watching ${target.displayName} :eyes:.`);
  const embed = u.embed({ author: target })
    .setTitle("User Watch")
    .setDescription(`${target} (${target.displayName}) has been added to the watch list by ${interaction.member}. Use </mod watch:${u.sf.commands.slashMod}> \`user\`: \`false\` command to remove them.`);
  watchLog?.send({ embeds: [embed] });
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction
 * @param {Discord.GuildMember} target
 */
async function modUnwatch(interaction, target) {
  if (!watchlist.has(target.id)) return interaction.editReply(`${target} wasn't on the watchlist. They might not have the trusted role.`);

  await u.db.user.updateWatch(target.id, false);
  const watchLog = interaction.client.getTextChannel(u.sf.channels.modlogs);
  watchlist.delete(target.id);

  interaction.editReply(`I'm no longer watching ${target.displayName} :zzz:.`);
  const embed = u.embed({ author: target })
    .setTitle("User Watch")
    .setDescription(`${target} (${target.displayName}) has been removed from the watch list by ${interaction.member}.`);
  watchLog?.send({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashModWatch(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const apply = interaction.options.getBoolean("apply") ?? true;
  if (!target) return interaction.editReply(noTarget);

  if (apply) {
    modWatch(interaction, target);
  } else {
    modUnwatch(interaction, target);
  }
}

/**
 * @param {Discord.GuildMember} member
 * @param {number} time
 */
async function getSummaryEmbed(member, time) {
  const data = await u.db.infraction.getSummary(member.id, time);
  const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
  if ((data.count > 0) && (data.detail.length > 0)) {
    data.detail = data.detail.reverse(); // Newest to oldest is what we want
    for (const record of data.detail) {
      const mod = record.mod ? member.guild.members.cache.get(record.mod) : undefined;
      const pointsPart = record.value === 0 && mod?.id !== Module.client.user?.id ? "Note" : `${record.value} pts`;
      response.push(`\`${record.timestamp.toLocaleDateString()}\` (${pointsPart}, modded by ${mod}): ${record.description}`);
    }
  }

  let text = response.join("\n");
  text = text.length > 4090 ? text.substring(0, 4090) + "..." : text;

  return u.embed({ author: member })
    .setTitle("Infraction Summary")
    .setDescription(text)
    .setColor(0x00ff00);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModBan(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason", true);
  const days = interaction.options.getInteger("clean") ?? 1;
  if (!target) return interaction.editReply(noTarget);
  return c.ban(interaction, target, reason, days);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModFilter(interaction) {
  const pf = new profanityFilter();
  await interaction.deferReply({ ephemeral: true });

  const word = interaction.options.getString("word", true).toLowerCase().trim();
  const mod = interaction.member;
  const modLogs = interaction.client.getTextChannel(u.sf.channels.modlogs);
  const apply = interaction.options.getBoolean("apply") ?? true;

  const filtered = pf.scan(word);
  if (!p.isMgmt(interaction) && !p.isMgr(interaction) && !p.isAdmin(interaction)) {
    return interaction.editReply("This command is for Management+ only.");
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

  let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  if (roleString.length > 1024) roleString = roleString.slice(0, 1020) + "...";

  const userDoc = await u.db.user.fetchUser(member.id);
  if (!userDoc) return interaction.editReply(`I couldn't find any info on ${member}!`);

  const e = await getSummaryEmbed(member, time);

  return interaction.editReply({ embeds: [
    e.addFields(
      { name: "ID", value: member.id, inline: true },
      { name: "Activity", value: `Posts: ${userDoc.posts}`, inline: true },
      { name: "Roles", value: roleString },
      { name: "Joined", value: member.joinedAt ? member.joinedAt.toUTCString() : "unknown", inline: true },
      { name: "Account Created", value: member.user.createdAt.toUTCString(), inline: true }
    )
  ] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModKick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";

    if (!target) return interaction.editReply(noTarget);
    return c.kick(interaction, target, reason);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModMute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";
    const apply = interaction.options.getBoolean("apply") ?? true;
    if (!target) return interaction.editReply(noTarget);

    if (apply) return c.mute(interaction, target, reason);
    else return c.unmute(interaction, target);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModNote(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const note = interaction.options.getString("note", true);
    if (!target) return interaction.editReply(noTarget);

    return await c.note(interaction, target, note);
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
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (!target) return interaction.editReply(noTarget);
    if (!c.compareRoles(interaction.member, target)) {
      return interaction.editReply(`You have insufficient permissions to put ${target} in the office!`);
    } else if (!target.manageable) {
      return interaction.editReply(`I have insufficient permissions to put ${target} in the office!`);
    }

    // Send 'em
    if (apply) {
      // Don't bother if it's already done
      if (target.roles.cache.has(u.sf.roles.ducttape)) return interaction.editReply(`They're already in the office.`);
      await target.roles.add(u.sf.roles.ducttape);

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
          .setTitle("Member Sent to Office")
          .setDescription(`**${interaction.member}** sent **${target}** to the office for:\n${reason}`)
          .setColor(0x0000ff)
      ] });

      await interaction.client.getTextChannel(u.sf.channels.office)?.send(
        `${target}, you have been sent to the office in ${interaction.guild.name}. `
        + 'This allows you and the mods to have a private space to discuss any issues without restricting access to the rest of the server. '
        + 'Please review our Code of Conduct. '
        + 'A member of the mod team will be available to discuss more details.\n\n'
        + 'http://ldsgamers.com/code-of-conduct'
      );

      return interaction.editReply(`Sent ${target} to the office.`);
    } else { // Remove "duct tape"
      // Don't bother if it's already done
      if (!target.roles.cache.has(u.sf.roles.ducttape)) return interaction.editReply(`They aren't in the office.`);

      // Remove "duct tape""
      await target.roles.remove(u.sf.roles.ducttape);

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Released from Office")
        .setDescription(`**${interaction.member}** let **${target}** out of the office.`)
        .setColor(0x00ff00)
      ] });

      return interaction.editReply(`Removed ${target} from the office.`);
    }
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModPurge(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const number = interaction.options.getInteger("number", true);
  let num = number;
  const reason = interaction.options.getString("reason") ?? "No provided reason";

  const channel = interaction.channel;
  if (num > 0 && channel) {
    await interaction.editReply(`Deleting ${num} messages...`);

    // Use bulkDelete() first
    while (num > 0) {
      const deleting = Math.min(num, 50);
      const deleted = await channel.bulkDelete(deleting, true);
      num -= deleted.size;
      if (deleted.size != deleting) break;
    }
    // Handle the remainder one by one
    while (num > 0) {
      const fetching = Math.min(num, 50);
      const msgsToDelete = await channel.messages.fetch({ limit: fetching, before: interaction.id }).catch(u.noop);
      if (!msgsToDelete) break;
      for (const [, msg] of msgsToDelete) await msg.delete().catch(u.noop);
      num -= msgsToDelete.size;
      if (msgsToDelete.size != fetching) break;
    }
    // Log it
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: interaction.member })
        .setTitle("Channel Purge")
        .setDescription(`**${interaction.member}** purged ${number - num} messages in ${interaction.channel}`)
        .addFields({ name: "Reason", value: reason })
        .setColor(0x00ff00)
    ] });

    return await interaction.followUp({ content: `${number - num} messages deleted.`, ephemeral: true });
  } else {
    return interaction.editReply("You need to provide a number greater than 0");
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModRename(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const reset = interaction.options.getBoolean("reset") ?? false;
  if (!target) return interaction.editReply(noTarget);
  return await c.rename(interaction, target, reset);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModShowWatchlist(interaction) {
  await interaction.deferReply({ ephemeral: true });
  watchlist = new Set((await u.db.user.getUsers({ watching: true })).map(usr => usr.discordId));

  const e = u.embed({ author: interaction.member })
    .setTitle("Watchlist")
    .setDescription(`List of those who are trusted but watched.`)
    .setColor(0x00ff00);

  let wlStr = "";
  for (const member of watchlist) {
    const user = interaction.guild.members.cache.get(member);
    wlStr += `${user}\n`;
  }
  if (wlStr.length == 0) {
    wlStr = "Nobody is on the list!";
  }

  e.addFields({ name: 'Members', value: wlStr });

  return await interaction.editReply({ embeds: [e] });
}

const molasses = new Map();

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModSlowmode(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const duration = interaction.options.getInteger("duration") ?? 10;
  const delay = interaction.options.getInteger("delay") ?? 15;
  const indefinitely = interaction.options.getBoolean("indefinite") ?? false;
  const ch = interaction.channel;
  if (!ch) return;

  if (duration == 0) {
    await ch.edit({ rateLimitPerUser: 0 }).catch(e => u.errorHandler(e, interaction));
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
        .setColor(0x00ff00)
        .setFooter({ text: old ? "Back to normal!" : "It's possible that the bot ran into an error while automatically resetting" })
    ] });
  } else {
    // Reset duration if already in slowmode
    const prev = molasses.get(ch.id);
    if (prev) clearTimeout(prev.timeout);

    const limit = prev ? prev.limit : ch.rateLimitPerUser;
    await ch.edit({ rateLimitPerUser: delay });

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
      .setColor(0x00ff00)
    ] });
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModTrust(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const type = interaction.options.getString("type", true);
  const apply = interaction.options.getBoolean("apply") ?? true;
  if (!member) return interaction.editReply(noTarget);

  const role = {
    'initial': u.sf.roles.trusted,
    'plus': u.sf.roles.trustedplus,
    'watch': u.sf.roles.untrusted
  }[type];
  const channel = {
    'initial': u.sf.channels.modlogs,
    'plus': u.sf.channels.modlogs,
    'watch': u.sf.channels.modlogsplus
  }[type];

  const embed = u.embed({ author: member });

  if (apply) {
    switch (type) {
    case 'initial':
      if (await c.trust(interaction, member)) return;
      await member.roles.add(role);
      return interaction.editReply(`${member} has been given the <@&${role}> role!`);
    case 'plus':
      if (await c.trustPlus(interaction, member)) return;
      await member.roles.add(role);
      return interaction.editReply(`${member} has been given the <@&${role}> role!`);
    }
  } else {
    switch (type) {
    case 'initial':
      if (!member.roles.cache.has(u.sf.roles.trusted)) return interaction.editReply(`${member} isn't trusted yet.`);

      await member.send(
        `You have been removed from "Trusted" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to post images. "
        + "Please remember to follow the Code of Conduct when posting images or links.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => c.blocked(member));

      embed.setTitle("User Trusted Removed")
        .setDescription(`${interaction.member} untrusted ${member}.`);
      if (member.roles.cache.has(u.sf.roles.trustedplus)) await member.roles.remove(u.sf.roles.trustedplus);
      await member.roles.remove(role);
      return interaction.editReply(`The <@&${role}> role has been removed from ${member}!`);
    case 'plus':
      if (!member.roles.cache.has(u.sf.roles.trustedplus)) return interaction.editReply(`${member} isn't trusted+ yet.`);

      await member.send(
        `You have been removed from "Trusted+" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to stream video in the server. "
        + "Please remember to follow the Code of Conduct.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => c.blocked(member));

      embed.setTitle("User Trusted+ Removed")
        .setDescription(`${interaction.member} removed the <@&${role}> role from ${member}.`);
      await member.roles.remove(role);
      return interaction.editReply(`The <@&${role}> role has been removed from ${member}!`);
    }
  }

  await interaction.client.getTextChannel(channel)?.send({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModWarn(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason", true);
  const value = interaction.options.getInteger("value") ?? 1;
  if (!member) return interaction.editReply(noTarget);


  const response = "We have received one or more complaints regarding content you posted. "
    + "We have reviewed the content in question and have determined, in our sole discretion, that it is against our code of conduct (<http://ldsgamers.com/code-of-conduct>). "
    + "This content was removed on your behalf. "
    + "As a reminder, if we believe that you are frequently in breach of our code of conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n"
    + `**${u.escapeText(interaction.member.displayName)}** has issued you a warning for:\n`
    + reason;
  await member.send(response).catch(() => c.blocked(member));

  const embed = u.embed({ author: member })
    .setColor("#0000FF")
    .setDescription(reason)
    .addFields({ name: "Resolved", value: `${u.escapeText(interaction.user.username)} issued a ${value} point warning.` })
    .setTimestamp();
  const flag = await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });

  await u.db.infraction.save({
    discordId: member.id,
    value: value,
    description: reason ?? "",
    flag: flag?.id ?? "unknown",
    mod: interaction.member.id
  });

  const summary = await u.db.infraction.getSummary(member.id);
  embed.addFields({ name: `Infraction Summary (${summary.time} Days) `, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` });

  flag?.edit({ embeds: [embed] });
  await interaction.editReply(`${member} has been warned **${value}** points for reason \`${reason}\``);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashModMain(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand(true);
    switch (subcommand) {
    case "ban":
      await slashModBan(interaction);
      break;
    case "filter":
      await slashModFilter(interaction);
      break;
    case "kick":
      await slashModKick(interaction);
      break;
    case "mute":
      await slashModMute(interaction);
      break;
    case "note":
      await slashModNote(interaction);
      break;
    case "office":
      await slashModOffice(interaction);
      break;
    case "purge":
      await slashModPurge(interaction);
      break;
    case "rename":
      await slashModRename(interaction);
      break;
    case "slowmode":
      await slashModSlowmode(interaction);
      break;
    case "watchlist":
      await slashModShowWatchlist(interaction);
      break;
    case "summary":
      await slashModSummary(interaction);
      break;
    case "trust":
      await slashModTrust(interaction);
      break;
    case "warn":
      await slashModWarn(interaction);
      break;
    case "watch":
      await slashModWatch(interaction);
      break;
    default:
      u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

Module.addInteraction({
  name: "mod",
  guildId: u.sf.ldsg,
  id: u.sf.commands.slashMod,
  onlyGuild: true,
  permissions: (int) => p.calc(int.member, ["mod"]),
  process: slashModMain
});

module.exports = Module;
