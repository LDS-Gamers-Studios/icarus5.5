// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  p = require("../utils/perms"),
  profanityFilter = require("profanity-matcher"),
  c = require("../utils/modCommon");


let watchlist = new Array();
const Module = new Augur.Module()
.addEvent("guildMemberAdd", async (member) => {
  const modLogsPlus = u.sf.channels.modlogsplus;
  if (member.guild.id == u.sf.ldsg) {
    try {
      const user = await u.db.user.fetchUser(member.id);
      if (!user || !("roles" in user)) {
        return;
      }
      // We expect user.roles to be a list []
      if (Array.isArray(user?.roles) && !user?.roles.includes(u.sf.roles.trusted)) {
        const watchLog = member.client.channels.cache.get(modLogsPlus);
        if (watchLog && watchLog.type === Discord.ChannelType.GuildText) {
          watchLog.send(`ℹ️ **${member.displayName}** has been automatically added to the watch list. Use the \`\\mod trust @user(s)\` command to remove them.`);
        }
      }
    } catch (e) { u.errorHandler(e, "Watchlist Auto-Add"); }
  }
})
.addEvent("ready", async () => {
  watchlist = await u.db.watchlist.fetchWatchlist();
})
.addEvent("messageCreate", watch)
.addEvent("messageUpdate", watch);

/**
 * Give the mods a heads up that someone isn't getting their DMs.
 * @param {Discord.GuildMember} member The guild member that's blocked.
 */
function blocked(member) {
  return member.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      description: `${member} has me blocked. *sadface*`
    })
  ] });
}

async function watch(msg, newMsg) {
  if (newMsg) msg = newMsg;
  const modLogsPlus = u.sf.channels.modlogsplus;
  const watchLog = msg.client.channels.cache.get(modLogsPlus);

  // Update these members
  if (msg.member?.roles.cache.has(u.sf.roles.untrusted)) {
    watchlist.push(msg.member.id);
    await u.db.watchlist.addToWatchlist(msg.member.id, true);
    await msg.member.roles.remove(u.sf.roles.untrusted);
    watchLog.send(`${msg.member.id} is affected?`);
  }

  if ((msg.guild?.id == u.sf.ldsg) && !msg.system && !msg.webhookID && !msg.author.bot &&
   (!msg.member?.roles.cache.has(u.sf.roles.trusted) || watchlist.includes(msg.member?.id))) {
    const files = msg.attachments.map(attachment => attachment.url);
    watchLog.send(`**${msg.member?.displayName || msg.author?.username}** in ${msg.channel}:\n>>> ${msg.cleanContent}`);
    if (files.length > 0) {
      watchLog.send({ files: files });
    }
  }
}

async function modWatch(interaction, target) {
  const embed = u.embed({ author: target });
  const watchLog = interaction.client.getTextChannel(u.sf.channels.modlogs);

  if (await u.db.watchlist.addToWatchlist(target.id, true)) {
    watchlist.push(target.id);
    interaction.editReply(`I'm watching ${target.displayName} :eyes:.`);
    embed.setTitle("User Watch")
    .setDescription(`${target} (${target.displayName}) has been added to the watch list by ${interaction.member}. Use \`/mod watch @user false\` command to remove them.`);
    await watchLog.send({ embeds: [embed] });
  } else {
    interaction.editReply(`${target.displayName} was already on the watchlist.`);
  }
}

async function modUnwatch(interaction, target) {
  const embed = u.embed({ author: target });
  const watchLog = interaction.client.getTextChannel(u.sf.channels.modlogs);

  if (await u.db.watchlist.removeFromWatchlist(target.id)) {
    watchlist.splice(watchlist.indexOf(target.id));
    interaction.editReply(`I'm no longer watching ${target.displayName} :zzz:.`);
    embed.setTitle("User Watch")
    .setDescription(`${target} (${target.displayName}) has been removed from the watch list by ${interaction.member}.`);
    await watchLog.send({ embeds: [embed] });
  } else {
    interaction.editReply(`${target.displayName} was not on the watchlist.`);
  }
}

async function slashModWatch(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const apply = interaction.options.getBoolean("apply") ?? true;

  if (apply) {
    modWatch(interaction, target);
  } else {
    modUnwatch(interaction, target);
  }
}

/**
 * @param {Discord.GuildMember} member
 * @param {number} time
 * @param {Discord.Guild} guild
 */
async function getSummaryEmbed(member, time, guild) {
  const data = await u.db.infraction.getSummary(member.id, time);
  const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
  if ((data.count > 0) && (data.detail.length > 0)) {
    data.detail = data.detail.reverse(); // Newest to oldest is what we want
    for (const record of data.detail) {
      const mod = record.mod ? guild.members.cache.get(record.mod) : undefined;
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

/** @param {Discord.CommandInteraction} interaction*/
async function slashModBan(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return Promise.resolve(u.errorHandler(Error(`Invalid interaction type received: ${interaction}`)));
  }
  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason");
  const days = interaction.options.getInteger("clean") ?? 1;

  return await c.ban(interaction, target, reason, days);
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModFilter(interaction) {
  const pf = new profanityFilter();
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const word = interaction.options.getString("word")?.toLowerCase().trim();
  const member = interaction.member;
  const modLogs = interaction.client.getTextChannel(u.sf.channels.modlogs);
  const filtered = pf.scan(word);
  const apply = interaction.options.getBoolean("apply") ?? true;
  if (!p.isMgmt(interaction) && !p.isMgr(interaction) && !p.isAdmin(interaction)) {
    interaction.editReply("This command is for Management, Discord Manager, and Bot Admins only.");
    return;
  }
  if (!modLogs) {
    interaction.editReply("modlogs is not set.");
    return;
  }
  if (apply) {
    if (!filtered.includes(word) && pf.add_word(word)) {
      const embed = u.embed({ author: member })
        .setTitle("Word added to the language filter.")
        .setDescription(`${member} added "${word}" to the language filter.`);
      await modLogs.send({ embeds: [embed] });
      await interaction.editReply(`"${word}" was added to the language filter.`);
    } else {
      await interaction.editReply(`"${word}" was already in the language filter.`);
    }
  } else if (pf.remove_word(word)) {
    const embed = u.embed({ author: member })
    .setTitle("Word removed from language filter.")
    .setDescription(`${member} removed "${word}" from the language filter.`);
    await modLogs.send({ embeds: [embed] });
    await interaction.editReply(`"${word}" has been removed from the language filter.`);
  } else {
    await interaction.editReply(`"${word}" was not found in the language filter.`);
  }
  return Module.client.emit("filterUpdate");
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModFullInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const member = interaction.options.getMember("user") ?? interaction.member;
  const time = interaction.options.getInteger("history") ?? 28;

  if (!member) {
    return u.errorHandler(Error("user/interaction.member is not set or null."), interaction);
  }

  let roleString = "";
  if (member.roles instanceof Discord.GuildMemberRoleManager) {
    member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  } else {
    member.roles.sort().join(", ");
  }
  if (roleString.length > 1024) roleString = roleString.substr(0, roleString.indexOf(", ", 1000)) + " ...";

  if (!(member instanceof Discord.GuildMember)) {
    return u.errorHandler(Error(`Member is not a GuildMember.`));
  }
  const userDoc = await u.db.user.fetchUser(member.id);

  if (!(interaction.guild instanceof Discord.Guild)) {
    return u.errorHandler(Error("Guild of member is not of type Guild."));
  }
  const e = await getSummaryEmbed(member, time, interaction.guild);

  return await interaction.editReply({ embeds: [
    e.addFields(
      { name: "ID", value: member.id, inline: true },
      { name: "Activity", value: `Posts: ${"posts" in userDoc ? userDoc.posts : "???"}`, inline: true },
      { name: "Roles", value: roleString },
      { name: "Joined", value: member.joinedAt ? member.joinedAt.toUTCString() : "unknown", inline: true },
      { name: "Account Created", value: member.user.createdAt.toUTCString(), inline: true }
    )
  ] });
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModKick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.isChatInputCommand()) {
      return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
    }
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";

    return await c.kick(interaction, target, reason);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModMute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.isChatInputCommand()) {
      return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
    }
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (apply) { // Mute 'em
      return await c.mute(interaction, target, reason);
    } else { // Remove mute
      return await c.unmute(interaction, target);
    }
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModNote(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.isChatInputCommand()) {
      return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
    }
    const target = interaction.options.getMember("user");
    const note = interaction.options.getString("note");

    return await c.note(interaction, target, note);
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModOffice(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.isChatInputCommand()) {
      return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
    }
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (!target) {
      return await interaction.editReply({
        content: `You cannot put ${target} in the office because they do not exist.`
      });
    }

    if ("manageable" in target && !target.manageable) {
      return await interaction.editReply({
        content: `I have insufficient permissions to put ${target} in the office!`
      });
    }

    // Send 'em
    if (apply) {
      // Don't bother if it's already done
      if ((target.roles instanceof Discord.GuildMemberRoleManager && target.roles.cache.has(u.sf.roles.ducttape)) ||
         (target.roles instanceof Array && target.roles.includes(u.sf.roles.ducttape))) {
        return await interaction.editReply({
          content: `They're already in the office.`
        });
      }

      // Impose "duct tape"
      if (target.roles instanceof Discord.GuildMemberRoleManager) {
        await target.roles.add(u.sf.roles.ducttape);
      } else {
        target.roles.push(u.sf.roles.ducttape);
      }
      // if (target.voice.channel) await target.voice.disconnect(reason);
      // muteState.set(target.id, target.voice.serverMute);
      // await target.voice.setMute(true, reason);

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Sent to Office")
        .setDescription(`**${interaction.member}** sent **${target}** to the office for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.client.getTextChannel(u.sf.channels.office)?.send(
        `${target}, you have been sent to the office in ${interaction.guild?.name}. `
        + 'This allows you and the mods to have a private space to discuss any issues without restricting access to the rest of the server. '
        + 'Please review our Code of Conduct. '
        + 'A member of the mod team will be available to discuss more details.\n\n'
        + 'http://ldsgamers.com/code-of-conduct'
      );

      return await interaction.editReply({
        content: `Sent ${target} to the office.`
      });
    } else { // Remove "duct tape"
      // Don't bother if it's already done
      if (target.roles instanceof Discord.GuildMemberRoleManager && !target.roles.cache.has(u.sf.roles.ducttape)) {
        await interaction.editReply({
          content: `They aren't in the office.`,
        });
        return;
      }

      // Remove "duct tape""
      if (target.roles instanceof Discord.GuildMemberRoleManager && !target.roles.cache.has(u.sf.roles.ducttape)) {
        await target.roles.remove(u.sf.roles.ducttape);
        // if (muteState.get(target.id)) await target.voice.setMute(false, "Mute resolved");
        // muteState.delete(target.id);
      }

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Released from Office")
        .setDescription(`**${interaction.member}** let **${target}** out of the office.`)
        .setColor(0x00ff00)
      ] });

      return await interaction.editReply({
        content: `Removed ${target} from the office.`,
      });
    }
  } catch (error) {
    return u.errorHandler(error, interaction);
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModPurge(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const number = interaction.options.getInteger("number") ?? 1;
  let num = number;
  const reason = interaction.options.getString("reason") ?? "";

  const channel = interaction.channel;
  if (num && num > 0 && channel) {
    await interaction.editReply({ content: `Deleting ${num} messages...` });

    // Use bulkDelete() first
    if (channel instanceof Discord.TextChannel) {
      while (num > 0) {
        const deleting = Math.min(num, 50);
        const deleted = await channel.bulkDelete(deleting, true);
        num -= deleted.size;
        if (deleted.size != deleting) { break; }
      }
    }
    // Handle the remainder one by one
    while (num > 0) {
      const fetching = Math.min(num, 50);
      const msgsToDelete = await channel.messages.fetch({ limit: fetching, before: interaction.id }).catch(u.noop);
      if (!msgsToDelete) { break; }
      for (const [, msg] of msgsToDelete) { await msg.delete().catch(u.noop); }
      num -= msgsToDelete.size;
      if (msgsToDelete.size != fetching) { break; }
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
    return await interaction.editReply({ content: `You need to tell me how many to delete!` });
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModRename(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");

  return await c.rename(interaction, target);
}

async function slashModShowWatchlist(interaction) {
  await interaction.deferReply({ ephemeral: true });
  watchlist = await u.db.watchlist.fetchWatchlist();

  const e = u.embed({ author: interaction.member })
    .setTitle("Watchlist")
    .setDescription(`List of those who are trusted but watched.`)
    .setColor(0x00ff00);

  let wlStr = "";
  for (const member of watchlist) {
    const user = interaction.guild.members.cache.get(member);
    wlStr = wlStr.concat(`${user}\n`);
  }
  if (wlStr.length == 0) {
    wlStr = "Nobody is on the list!";
  }

  e.addFields({ name: 'Members', value: wlStr });

  return await interaction.editReply({ embeds: [e] });
}

const molasses = new Map();

/** @param {Discord.CommandInteraction} interaction*/
async function slashModSlowmode(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const duration = interaction.options.getInteger("duration") ?? 10;
  const timer = interaction.options.getInteger("timer") ?? 15;
  const indefinitely = interaction.options.getBoolean("indefinitely") ?? false;
  const ch = interaction.options.getChannel("channel") ?? interaction.channel;
  const ct = Discord.ChannelType;

  if (!ch || !(ch instanceof Discord.TextChannel)) {
    u.errorHandler(Error("Invalid channel in slashModSlowmode"));
    return interaction.editReply("I've got an invalid channel.");
  }

  if ([ ct.GuildCategory, ct.GuildStageVoice, ct.GuildDirectory ].includes(ch.type)) {
    return await interaction.editReply("You can't set slowmode in that channel.");
  }

  if (duration == 0) {
    ch.edit({ rateLimitPerUser: 0 }).catch(e => u.errorHandler(e, interaction));
    const old = molasses.get(ch.id);
    if (old) {
      clearTimeout(old);
      molasses.delete(ch.id);
    }

    interaction.editReply("Slowmode deactivated.");
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: { name: interaction.member } })
        .setTitle("Channel Slowmode")
        .setDescription(`${interaction.member} disabled slowmode in ${ch}`)
        .setColor(0x00ff00)
        .setFooter({ text: old ? "" : "It's possible that the bot ran into an error while automatically resetting" })
    ] });
  } else {
    // Reset duration if already in slowmode
    const prev = molasses.get(ch.id);
    if (prev) clearTimeout(prev.timeout);

    const limit = prev ? prev.limit : ch.rateLimitPerUser;
    await ch.edit({ rateLimitPerUser: timer });

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

    await interaction.editReply(`${timer}-second slowmode activated ${durationStr}.`);
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Slowmode")
      .setDescription(`${interaction.member} set a ${timer}-second slow mode ${durationStr} in ${ch}.`)
      .setColor(0x00ff00)
    ] });
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModSummary(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const member = interaction.options.getMember("user");
  const time = interaction.options.getInteger("history") ?? 28;

  if (!member || !(member instanceof Discord.GuildMember)) {
    return u.errorHandler(Error("Invalid member given."));
  }

  if (interaction.guild) {
    const e = await getSummaryEmbed(member, time, interaction.guild);
    await interaction.editReply({ embeds: [ e ] });
  }
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModTrust(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const member = interaction.options.getMember("user");
  const type = interaction.options.getString("type");
  const apply = interaction.options.getBoolean("apply") ?? true;

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

  if (!member || !(member instanceof Discord.GuildMember)) {
    return u.errorHandler(Error("Invalid member given to /mod trust"));
  }

  const embed = u.embed({ author: member });

  if (!(member.roles instanceof Discord.GuildMemberRoleManager)) {
    return u.errorHandler(Error("member.roles is not an instance of GuildMemberRoleManager"));
  }

  if (apply) {
    switch (type) {
    case 'initial':
      await c.trust(interaction, member);
      await member.roles.add(role);
      await interaction.editReply({ content: `${member} has been given the <@&${role}> role!` });
      return;
    case 'plus':
      await c.trustPlus(interaction, member);
      await member.roles.add(role);
      await interaction.editReply({ content: `${member} has been given the <@&${role}> role!` });
      return;
    case 'watch':
      modWatch(interaction, member);
      break;
    }

  } else {
    switch (type) {
    case 'initial':
      if (!member.roles.cache.has(u.sf.roles.trusted)) {
        await interaction.editReply({ content: `${member} isn't trusted yet.` });
        return;
      }
      await member.send(
        `You have been removed from "Trusted" in ${interaction.guild?.name}. `
        + "This means you no longer have the ability to post images. "
        + "Please remember to follow the Code of Conduct when posting images or links.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted Removed")
      .setDescription(`${interaction.member} untrusted ${member}.`);
      if (member.roles.cache.has(u.sf.roles.trustedplus)) {
        await member.roles.remove(u.sf.roles.trustedplus);
      }
      await member.roles.add(u.sf.roles.untrusted);
      await member.roles.remove(role);
      await interaction.editReply({ content: `The <@&${role}> role has been removed from ${member}!` });
      break;
    case 'plus':
      if (!member.roles.cache.has(u.sf.roles.trustedplus)) {
        interaction.editReply({ content: `${member} isn't trusted+ yet.` });
        return;
      }
      await member.send(
        `You have been removed from "Trusted+" in ${interaction.guild?.name}. `
        + "This means you no longer have the ability to stream video in the server. "
        + "Please remember to follow the Code of Conduct.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted+ Removed")
      .setDescription(`${interaction.member} removed the <@&${role}> role from ${member}.`);
      await member.roles.remove(role);
      await interaction.editReply({ content: `The <@&${role}> role has been removed from ${member}!` });
      break;
    case 'watch':
      modUnwatch(interaction, member);
      break;
    }
  }

  await interaction.client.getTextChannel(channel)?.send({ embeds: [embed] });
}

/** @param {Discord.CommandInteraction} interaction*/
async function slashModWarn(interaction) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.isChatInputCommand()) {
    return u.errorHandler(Error(`Invalid interaction type received: ${interaction}`));
  }
  const member = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason");
  const value = interaction.options.getInteger("value") ?? 1;

  if (!member || !(member instanceof Discord.GuildMember)) {
    return u.errorHandler(Error("Invalid member given to /mod warn"));
  }

  const mod = interaction.member;

  let modId = "unknown";
  let modName = "unknown mod";
  if (mod instanceof Discord.GuildMember) {
    modId = mod.id;
    modName = mod.displayName;
  }

  const response = "We have received one or more complaints regarding content you posted. "
    + "We have reviewed the content in question and have determined, in our sole discretion, that it is against our code of conduct (<http://ldsgamers.com/code-of-conduct>). "
    + "This content was removed on your behalf. "
    + "As a reminder, if we believe that you are frequently in breach of our code of conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n"
    + `**${u.escapeText(modName)}** has issued you a warning for:\n`
    + reason;
  await member.send(response).catch(() => blocked(member));

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
    message: interaction.id,
    flag: flag?.id ?? "unknown",
    channel: interaction.channel?.id ?? "unknown",
    mod: modId
  });

  const summary = await u.db.infraction.getSummary(member.id);
  embed.addFields({ name: `Infraction Summary (${summary.time} Days) `, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` });

  flag?.edit({ embeds: [embed] });
  await interaction.editReply(`${member} has been warned **${value}** points for reason \`${reason}\``);
}

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
    case "fullinfo":
      await slashModFullInfo(interaction);
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
  // guild: u.sf.ldsg,
  id: u.sf.commands.slashMod,
  permissions: p.isMod,
  /** @param {Discord.CommandInteraction} interaction*/
  process: slashModMain
});

module.exports = Module;
