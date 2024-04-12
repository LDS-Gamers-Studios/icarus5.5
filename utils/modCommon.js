// @ts-check
const { ButtonStyle } = require("discord.js"),
  Discord = require('discord.js'),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  { ActionRowBuilder, ButtonBuilder } = require("discord.js"),
  Augur = require('augurbot-ts');


const modActions = [
  new ActionRowBuilder().setComponents(
    new ButtonBuilder().setCustomId("modCardClear").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("modCardVerbal").setEmoji("🗣").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("modCardMinor").setEmoji("⚠").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("modCardMajor").setEmoji("⛔").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("modCardMute").setEmoji("🔇").setStyle(ButtonStyle.Danger)
  ),
  new ActionRowBuilder().setComponents(
    new ButtonBuilder().setCustomId("modCardInfo").setEmoji("👤").setLabel("User Info").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("modCardLink").setEmoji("🔗").setLabel("Link to Discuss").setStyle(ButtonStyle.Secondary)
  )
];

/**
  * Give the mods a heads up that someone isn't getting their DMs.
  * @param {Discord.GuildMember} member The guild member that's blocked.
  */
function blocked(member) {
  return member.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      title: `${member.displayName} has me blocked. *sadface*`
    })
  ] });
}

/**
 * See if a user is manageable by a mod
 * @param {Discord.GuildMember} mod
 * @param {Discord.GuildMember} target
 */
function compareRoles(mod, target) {
  const modHigh = mod.roles.cache.filter(r => r.id != u.sf.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  const targetHigh = target.roles.cache.filter(r => r.id != u.sf.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  if (!modHigh || !targetHigh) return false;
  return (modHigh.comparePositionTo(targetHigh) > 0);
}

function nameGen() {
  const { names, colors, adjectives } = require("../data/nameParts.json");
  let result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names);
  while (result.length > 32) { result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names); }
  return result;
}

const modCommon = {
  blocked,
  compareRoles,
  nameGen,
  /**
   * BAN HAMMER!!!
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   * @param {number} days
   */
  ban: async function(interaction, target, reason, days) {
    try {
      if (!compareRoles(interaction.member, target)) {
        interaction.editReply(`You have insufficient permissions to ban ${target}!`);
        return;
      } else if (!target.bannable) {
        interaction.editReply(`I have insufficient permissions to ban ${target}!`);
        return;
      }

      const confirm = await u.confirmInteraction(interaction, `Ban ${target} for:\n${reason}?`, `Confirm Ban on ${u.escapeText(target.displayName)}`);
      if (confirm) {
        // Do the ban!

        // The actual ban part
        const targetRoles = target.roles.cache.clone();
        await target.send({ embeds: [
          u.embed()
          .setTitle("User Ban")
          .setDescription(`You have been banned in ${interaction.guild.name} for:\n${reason}`)
        ] }).catch(() => blocked(target));
        await target.ban({ deleteMessageSeconds: days * 24 * 60 * 60, reason });

        // Edit interaction
        await interaction.editReply({
          embeds: [
            u.embed({ author: target })
            .setColor(0x00ff00)
            .setDescription(`${target.toString()} banned for:\n${reason}`)
          ],
          components: []
        });

        // Save infraction
        u.db.infraction.save({
          discordId: target.id,
          description: `[User Ban]: ${reason}`,
          value: 30,
          mod: interaction.member.id
        });

        // Save roles
        targetRoles.delete(u.sf.roles.trusted);
        u.db.user.updateRoles(target, targetRoles);

        // Log it
        interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
          u.embed({ author: target })
          .setTitle("User Ban")
          .setDescription(`**${interaction.member}** banned **${target}** for:\n${reason}`)
          .setColor(0x0000ff)
        ] });
      } else {
        // Never mind
        await interaction.editReply({
          embeds: [u.embed({ author: interaction.member }).setColor(0x0000ff).setDescription(`Ban ${confirm === false ? "cancelled" : "timed out"}`)],
          components: []
        });
      }
      u.cleanInteraction(interaction);
    } catch (error) { u.errorHandler(error, interaction); }
  },

  /**
   * Generate and send a warning card in #mod-logs
   * @param {object} flagInfo
   * @param {Discord.Message} flagInfo.msg The message for the warning.
   * @param {Discord.GuildMember} flagInfo.member The member for the warning.
   * @param {String|[String]} flagInfo.matches If automatic, the reason for the flag.
   * @param {Boolean} flagInfo.pingMods Whether to ping the mods.
   * @param {Discord.GuildMember} flagInfo.snitch The user bringing up the message.
   * @param {String} flagInfo.flagReason The reason the user is bringing it up.
   * @param {String} flagInfo.furtherInfo Where required, further information.
   */
  createFlag: async function(flagInfo) {
    let { matches } = flagInfo;
    const { msg, member, pingMods, snitch, flagReason, furtherInfo } = flagInfo;
    const client = msg.client;

    if (!msg.inGuild()) return null;

    const infractionSummary = await u.db.infraction.getSummary(member.id);
    const embed = u.embed({ color: 0xff0000, author: member });

    if (Array.isArray(matches)) matches = matches.join(", ");
    if (matches) embed.addFields({ name: "Match", value: matches });

    embed.setTimestamp(msg.editedAt ?? msg.createdAt)
      .setDescription((msg.editedAt ? "[Edited]\n" : "") + msg.cleanContent)
      .addFields(
        { name: "Channel", value: msg.channel?.toString(), inline: true },
        { name: "Jump to Post", value: `[Original Message](${msg.url})`, inline: true },
        { name: "User", value: msg.webhookId ? msg.author.username ?? (await msg.fetchWebhook()).name : member.displayName ?? "Unknown User" }
      );

    if (msg.channel.parentId == u.sf.channels.minecraftcategory && msg.webhookId) return; // I lied actually do stuff
    if (snitch) {
      embed.addFields({ name: "Flagged By", value: snitch.toString(), inline: true })
      .addFields({ name: "Reason", value: flagReason, inline: true });
      if (furtherInfo) embed.addFields({ name: "Further Information", value: furtherInfo, inline: true });
    }

    embed.addFields({ name: `Infraction Summary (${infractionSummary.time} Days)`, value: `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}` });
    if (member.user.bot) embed.setFooter({ text: "The user is a bot and the flag likely originated elsewhere. No action will be processed." });

    const content = [];
    if (pingMods) {
      u.clean(msg, 0);
      const ldsg = client.guilds.cache.get(u.sf.ldsg);
      if (!member.roles.cache.has(u.sf.roles.muted)) {
        content.push(ldsg?.roles.cache.get(u.sf.roles.mod)?.toString());
      }
      if (member.user.bot) {
        content.push("The message has been deleted. The member was *not* muted, on account of being a bot.");
      } else {
        if (!member.roles?.cache.has(u.sf.roles.muted)) {
          await member.roles?.add(u.sf.roles.muted);
          if (member.voice?.channel) {
            member.voice?.disconnect("Auto-mute");
          }
          ldsg?.client.getTextChannel(u.sf.channels.muted)?.send({
            content: `${member}, you have been auto-muted in ${msg.guild.name}. Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct`,
            allowedMentions: { users: [member.id] }
          });
        }
        content.push("The mute role has been applied and message deleted.");
      }
    }

    const card = await client.getTextChannel(u.sf.channels.modlogs)?.send({
      content: content.join('\n'),
      embeds: [embed],
      // @ts-ignore its being dumb
      components: (member.user.bot || !msg ? undefined : modActions),
      allowedMentions: { roles: [u.sf.roles.mod] }
    });

    if (!card) throw new Error("Card creation failed!");

    if (!member.user.bot && msg) {
      const infraction = {
        discordId: member.id,
        channel: msg.channel.id,
        message: msg.id,
        flag: card.id,
        description: msg.cleanContent,
        mod: client.user.id,
        value: 0
      };
      await u.db.infraction.save(infraction);
    }
    return card;
  },

  /**
   * Get a summary embed
   * @param {Discord.GuildMember} member
   * @param {number} [time]
   */
  getSummaryEmbed: async function(member, time) {
    const data = await u.db.infraction.getSummary(member.id, time);
    const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
    if ((data.count > 0) && (data.detail.length > 0)) {
      data.detail = data.detail.reverse(); // Newest to oldest is what we want
      for (const record of data.detail) {
        const mod = member.guild.members.cache.get(record.mod);
        const pointsPart = record.value === 0 && (mod?.id != member.client.user.id) ? "Note" : `${record.value} pts`;
        response.push(`\`${record.timestamp.toLocaleDateString()}\` (${pointsPart}, modded by ${mod || `Unknown Mod (<@${record.mod }>)`}): ${record.description}`);
      }
    }
    let text = response.join("\n");
    text = text.length > 4090 ? text.substring(0, 4086) + "..." : text;
    return u.embed({ author: member })
      .setTitle("Infraction Summary")
      .setDescription(text)
      .setColor(0x00ff00);
  },

  /**
   * They get the boot
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   */
  kick: async function(interaction, target, reason) {
    try {
      if (!compareRoles(interaction.member, target)) {
        interaction.editReply(`You have insufficient permissions to kick ${target}!`);
        return;
      } else if (!target.kickable) {
        interaction.editReply(`I have insufficient permissions to kick ${target}!`);
        return;
      }

      const confirm = await u.confirmInteraction(interaction, `Kick ${target} for:\n${reason}?`, `Confirm Kick on ${u.escapeText(target.displayName)}`);
      if (confirm) {
        // Do the kick!

        // The actual kick part
        const targetRoles = target.roles.cache.clone();
        await target.send({ embeds: [
          u.embed()
          .setTitle("User Kick")
          .setDescription(`You have been kicked in ${interaction.guild.name} for:\n${reason}`)
        ] }).catch(() => blocked(target));
        await target.kick(reason);

        // Edit interaction
        await interaction.editReply({
          embeds: [
            u.embed({ author: target })
            .setColor(0x00ff00)
            .setDescription(`${target.toString()} kicked for:\n${reason}`)
          ],
          components: []
        });

        // Save infraction
        u.db.infraction.save({
          discordId: target.id,
          description: `[User Kick]: ${reason}`,
          value: 30,
          mod: interaction.member.id
        });

        // Save roles
        targetRoles.delete(u.sf.roles.trusted);
        u.db.user.updateRoles(target, targetRoles);

        // Log it
        interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
          u.embed({ author: target })
          .setTitle("User Kick")
          .setDescription(`**${interaction.member}** kicked **${target}** for:\n${reason}`)
          .setColor(0x0000ff)
        ] });
      } else {
        // Never mind
        await interaction.editReply({
          embeds: [u.embed({ author: target }).setColor(0x0000ff).setDescription(`Kick ${confirm === false ? "cancelled" : "timed out"}`)],
          components: []
        });
      }
    } catch (error) { u.errorHandler(error, interaction); }
  },

  /**
   * Prevent someone from talking
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   */
  mute: async function(interaction, target, reason) {
    if (!compareRoles(interaction.member, target)) {
      interaction.editReply(`You have insufficient permissions to mute ${target}!`);
      return;
    } else if (!target.manageable) {
      interaction.editReply(`I have insufficient permissions to mute ${target}!`);
      return;
    }

    try {
      // Don't mute if muted
      if (target.roles.cache.has(u.sf.roles.muted)) {
        interaction.editReply(`They are already muted.`);
        return;
      }

      // Impose Mute
      await target.roles.add(u.sf.roles.muted);

      if (target.voice.channel) {
        await target.voice.disconnect(reason);
        await target.voice.setMute(true, reason);
      }

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Mute")
        .setDescription(`**${interaction.member}** muted **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.client.getTextChannel(u.sf.channels.muted)?.send(
        `${target}, you have been muted in ${interaction.guild.name}. `
      + 'Please review our Code of Conduct. '
      + 'A member of the mod team will be available to discuss more details.\n\n'
      + 'http://ldsgamers.com/code-of-conduct'
      );

      interaction.editReply(`Muted ${target}.`);
    } catch (error) { u.errorHandler(error, interaction); }
  },

  /**
   *
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} note
   */
  note: async function(interaction, target, note) {
    try {
      await u.db.infraction.save({
        discordId: target.id,
        value: 0,
        description: note,
        mod: interaction.user.id
      });
      const summary = await u.db.infraction.getSummary(target.id);

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
        .setColor("#0000FF")
        .setDescription(note)
        .addFields(
          { name: "Resolved", value: `${u.escapeText(interaction.user.username)} added a note.` },
          { name: `Infraction Summary (${summary.time} Days)`, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` }
        )
        .setTimestamp()
      ] });

      await interaction.editReply(`Note added for user ${target.toString()}.`);
    } catch (error) { u.errorHandler(error, interaction); }
  },

  /**
   *
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   */
  rename: async function(interaction, target, reset = false) {
    const newNick = interaction.options.getString("name") ?? nameGen();
    const oldNick = target.displayName;

    if (!compareRoles(interaction.member, target)) {
      interaction.editReply(`You have insufficient permissions to rename ${target}!`);
      return;
    } else if (!target.manageable) {
      interaction.editReply(`I have insufficient permissions to rename ${target}!`);
      return;
    }
    await target.setNickname(reset ? null : newNick);

    const comment = `Set nickname to ${u.escapeText(reset ? "default" : newNick)} from ${u.escapeText(oldNick)}.`;

    if (!reset) {
      await u.db.infraction.save({
        discordId: target.id,
        value: 0,
        description: comment,
        message: interaction.id,
        channel: interaction.channel?.id,
        mod: interaction.member.id
      });
    }
    const summary = await u.db.infraction.getSummary(target.id);

    interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: target })
      .setColor("#0000FF")
      .setDescription(comment)
      .addFields(
        { name: "Resolved", value: `${interaction.member} changed ${target}'s nickname from ${u.escapeText(oldNick)} to ${u.escapeText(reset ? "default" : newNick)}.` },
        { name: `Infraction Summary (${summary.time} Days) `, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` }
      )
      .setTimestamp()
    ] });

    interaction.editReply(`${target}'s nickname changed from ${u.escapeText(oldNick)} to ${u.escapeText(reset ? "default" : newNick)}.`);
  },

  /**
   * @param {string[]} searchContent
   * @param {Discord.Guild} guild
   * @param {Discord.Message<true>} message
   * @param {boolean} auto
   */
  spamCleanup: async function(searchContent, guild, message, auto = false) {
    /** @type {Discord.Collection<string, Discord.Message<true>>} */
    let toDelete = new u.Collection();
    let deleted = 0;
    let notDeleted = false;
    const timeDiff = config.spamThreshold.cleanupLimit * (auto ? 1 : 2);
    const contents = u.unique(searchContent);
    for (const [, channel] of guild.channels.cache) {
      if (channel.isTextBased() && channel.messages.cache.size > 0) {
        const messages = channel.messages.cache.filter(m =>
          m.createdTimestamp <= (timeDiff + message.createdTimestamp) &&
          m.createdTimestamp >= (timeDiff - message.createdTimestamp) &&
          m.author.id == (message.author.id ?? message.id) &&
          contents.includes(message.content.toLowerCase()));
        if (messages.size > 0) toDelete = toDelete.concat(messages);
      }
    }
    for (const [, msg] of toDelete) {
      try {
        await msg.delete();
        deleted++;
      } catch (error) {
        u.errorHandler(error)?.then(notDeleted ? u.clean : u.noop);
        notDeleted = true;
      }
    }

    return { deleted, notDeleted, toDelete: toDelete.size };
  },

  /**
   * Briefly prevent someone from talking
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {number} time Minutes, default is 10
   * @param {string} reason
   */
  timeout: async function(interaction, target, time = 10, reason) {
    // Do it
    await target.timeout(time * 60 * 1000, reason);

    // Log it
    interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("User Timeout")
      .setDescription(`**${interaction.member}** timed out ${target}`)
      .addFields({ name: 'Reason', value: reason })
      .setColor(0x00ff00)
    ] });
  },

  /**
   * Give someone the Trusted Role
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   */
  trust: async function(interaction, target) {
    if (target.roles.cache.has(u.sf.roles.trusted)) {
      return interaction.editReply(`${target} is already trusted.`);
    }

    target.send(
      `You have been marked as "Trusted" in ${interaction.guild.name} . `
      + "This means you are now permitted to post images and links in chat. "
      + "Please remember to follow the Code of Conduct when doing so.\n"
      + "<http://ldsgamers.com/code-of-conduct>\n\n"
      + "If you'd like to join one of our in-server Houses, you can visit <http://3houses.live> to get started!"
    ).catch(() => blocked(target));

    const embed = u.embed({ author: target })
      .setTitle("User Given Trusted")
      .setDescription(`${interaction.member} trusted ${target}.`);
    await u.db.user.updateWatch(target.id, false);
    await target.roles.add(u.sf.roles.trusted);
    await interaction.editReply(`${target} has been given the <@&${u.sf.roles.trusted}> role!`);
    interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
  },

  /**
   * Give someone the Trusted+ Role
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   */
  trustPlus: async function(interaction, target) {
    if (target.roles.cache.has(u.sf.roles.trustedplus)) {
      return interaction.editReply(`${target} is already trusted+.`);
    }
    if (!target.roles.cache.has(u.sf.roles.trusted)) {
      return interaction.editReply(`${target} needs <@&${u.sf.roles.trusted}> before they can be given <@&${u.sf.roles.trustedplus}>!`);
    }
    target.send(
      "Congratulations! "
      + "You've been added to the Trusted+ list in LDSG, allowing you to stream to voice channels!\n\n"
      + "While streaming, please remember the Streaming Guidelines ( https://goo.gl/Pm3mwS ) and LDSG Code of Conduct ( http://ldsgamers.com/code-of-conduct ). "
      + "Also, please be aware that LDSG may make changes to the Trusted+ list from time to time at its discretion."
    ).catch(u.noop);

    const embed = u.embed({ author: target })
      .setTitle("User Given Trusted+")
      .setDescription(`${interaction.member} gave ${target} the <@&${u.sf.roles.trustedplus}> role.`);

    await target.roles.add(u.sf.roles.trustedplus);
    await interaction.editReply(`${target} has been given the <@&${u.sf.roles.trustedplus}> role!`);
    await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
  },

  /**
   * Let someone talk again
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   */
  unmute: async function(interaction, target) {
    try {
      // Don't unmute if not muted
      if (!target.roles.cache.has(u.sf.roles.muted)) {
        interaction.editReply(`${target} isn't muted.`);
        return;
      }

      // Remove Mute
      await target.roles.remove(u.sf.roles.muted);
      if (target.voice.channel) await target.voice.setMute(false, "Mute resolved");

      await interaction.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [
        u.embed({ author: target })
          .setTitle("Member Unmute")
          .setDescription(`**${interaction.member}** unmuted **${target}**`)
          .setColor(0x00ff00)
      ] });

      interaction.editReply(`Unmuted ${target}.`);
    } catch (error) { u.errorHandler(error, interaction); }
  }
};

module.exports = modCommon;
