// @ts-check
const { ButtonStyle } = require("discord.js"),
  Discord = require('discord.js'),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  Augur = require('augurbot-ts');

const embedColors = {
  action: 0xff0000,
  handled: 0x0000ff,
  info: 0x00ffff,
  success: 0x00ff00
};

const modActions = [
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("modCardClear").setEmoji("✅").setLabel("Clear").setStyle(ButtonStyle.Success),
    new u.Button().setCustomId("modCardVerbal").setEmoji("🗣").setLabel("Talk it out").setStyle(ButtonStyle.Primary),
    new u.Button().setCustomId("modCardMinor").setEmoji("⚠").setLabel("Minor").setStyle(ButtonStyle.Danger),
    new u.Button().setCustomId("modCardMajor").setEmoji("⛔").setLabel("Major").setStyle(ButtonStyle.Danger),
    new u.Button().setCustomId("modCardMute").setEmoji("🔇").setLabel("Mute").setStyle(ButtonStyle.Danger)
  ]),
  u.MessageActionRow().setComponents([
    new u.Button().setCustomId("modCardInfo").setEmoji("👤").setLabel("User Info").setStyle(ButtonStyle.Secondary),
    new u.Button().setCustomId("modCardLink").setEmoji("🔗").setLabel("Link to Discuss").setStyle(ButtonStyle.Secondary)
  ])
];
/** @param {Discord.GuildMember|Discord.User|Discord.Webhook} person */
const userBackup = (person) => `${person} (${u.escapeText("displayName" in person ? person.displayName : person.name)})`;

const retract = u.MessageActionRow().setComponents([
  new u.Button().setCustomId("modCardRetract").setEmoji("⏪").setLabel("Retract").setStyle(ButtonStyle.Danger)
]);

const messageFromMods = "## 🚨 Message from the LDSG Mods:\n";
const code = "[Code of Conduct](http://ldsgamers.com/code-of-conduct)";

/**
 * @param {Augur.GuildInteraction<"Any">|Discord.Message} int The interaction (gets the mod from this)
 * @param {Discord.GuildMember | Discord.User} tg The target of the command
 */
const logEmbed = (int, tg) => u.embed({ author: tg })
.addFields(
  { name: "User", value: userBackup(tg) },
  { name: "Mod", value: userBackup(int.member ?? (int instanceof Discord.Message ? int.author : int.user)) }
);

/**
  * Give the mods a heads up that someone isn't getting their DMs.
  * @param {Discord.GuildMember | Discord.User} user The guild member that's blocked.
  */
function blocked(user) {
  return user.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
    u.embed({
      author: user,
      color: embedColors.info,
      title: `${userBackup(user)} has me blocked. *sadface*`
    })
  ] });
}

/**
 * See if a user is manageable by a mod
 * @param {Discord.GuildMember} mod
 * @param {Discord.GuildMember} target
 */
function compareRoles(mod, target) {
  const modHigh = mod.roles.cache.filter(r => r.id !== u.sf.roles.streaming.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  const targetHigh = target.roles.cache.filter(r => r.id !== u.sf.roles.streaming.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  if (!modHigh || !targetHigh) return false;
  return (modHigh.comparePositionTo(targetHigh) > 0);
}

/** Generate a random name */
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
  userBackup,
  logEmbed,
  modActions,
  messageFromMods,
  revert: retract,
  colors: embedColors,
  getBanList: () => require("../data/banned.json"),
  refreshBanList: () => delete require.cache[require.resolve("../data/banned.json")],
  /**
   * BAN HAMMER!!!
   * @template {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString">} T
   * @param {T} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   * @param {number} days
   * @returns {Promise<{ payload: Discord.InteractionEditReplyOptions | string, interaction: T | Discord.ButtonInteraction} | null>}
   */
  ban: async function(interaction, target, reason, days = 1) {
    let success = false;
    let confirm;
    try {
      if (!compareRoles(interaction.member, target)) return { payload: `You have insufficient permissions to ban ${target}!`, interaction };
      else if (!target.bannable) return { payload: `I have insufficient permissions to ban ${target}!`, interaction };

      confirm = await u.confirmInteraction(interaction, `Ban ${target} for:\n${reason}?`, `Confirm Ban on ${u.escapeText(target.displayName)}`);
      if (!confirm) return null;

      // The actual ban part
      const targetRoles = target.roles.cache.clone();
      await target.send({ content: messageFromMods, embeds: [ u.embed()
        .setTitle("User Ban")
        .setDescription(`You have been banned from ${interaction.guild.name}`)
        .addFields({ name: "Details", value: reason })
        .setFooter({ text: `${interaction.member} has issued this ban.` })
      ] }).catch(() => blocked(target));

      await target.ban({ deleteMessageSeconds: days * 24 * 60 * 60, reason });
      success = true;

      // Save infraction
      await u.db.infraction.save({
        discordId: target.id,
        description: `[User Ban]: ${reason}`,
        value: 30,
        mod: interaction.member.id
      });

      // Save roles
      targetRoles.delete(u.sf.roles.moderation.trusted);
      u.db.user.updateRoles(target, targetRoles.map(r => r.id));

      // Log it
      interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle(`${interaction.client.emojis.cache.get(u.sf.emoji.banhammer) ?? ""} User Ban`)
          .addFields({ name: "Reason", value: reason })
          .setColor(embedColors.info)
          .setFooter({ text: `Deleted ${days} day(s) of messages` })
      ] });

      // Return results
      return {
        payload: {
          embeds: [
            u.embed({ author: target })
              .setColor(embedColors.success)
              .setDescription(`${target} banned for:\n${reason}`)
          ],
          components: []
        },
        interaction: confirm
      };
    } catch (error) {
      await u.errorHandler(error, interaction);
      return {
        payload: "I ran into an error! " + (success ? `${target} was banned though.` : `${target} wasn't banned.`),
        interaction: confirm ?? interaction
      };
    }
  },

  /**
   * Generate and send a warning card in #mod-logs
   * @param {object} flagInfo
   * @param {Discord.Message} [flagInfo.msg] The message for the warning.
   * @param {Discord.GuildMember|Discord.User|Discord.Webhook} flagInfo.member The member for the warning.
   * @param {String|String[]} [flagInfo.matches] If automatic, the reason for the flag.
   * @param {Boolean} [flagInfo.pingMods] Whether to ping the mods.
   * @param {Discord.GuildMember|Discord.User} [flagInfo.snitch] The user bringing up the message.
   * @param {String} flagInfo.flagReason The reason the user is bringing it up.
   * @param {String} [flagInfo.furtherInfo] Where required, further information.
   * @param {Discord.CommandInteraction|Discord.AnySelectMenuInteraction} [interaction] Optional interaction property to provide missing details
   */
  createFlag: async function(flagInfo, interaction) {
    let { matches } = flagInfo;
    const { msg, member, pingMods, snitch, flagReason, furtherInfo } = flagInfo;
    const client = msg?.client ?? member?.client;
    const isMember = member instanceof Discord.GuildMember;
    const bot = isMember ? member.user.bot : member instanceof Discord.Webhook ? member : member.bot;
    const user = msg?.webhookId ? await msg.fetchWebhook().catch(u.noop) ?? member : member;
    if (msg && !msg.inGuild()) return null;

    const infractionSummary = await u.db.infraction.getSummary(user.id);
    const embed = u.embed({ color: embedColors.action, author: user });

    if (Array.isArray(matches)) matches = matches.join(", ");
    if (matches) embed.addFields({ name: "Matched", value: matches });
    if (msg) {
      embed.setTimestamp(msg.editedAt ?? msg.createdAt)
        .setDescription((msg.editedAt ? "[Edited]\n" : "") + msg.cleanContent || null)
        .addFields(
          { name: "Channel", value: msg.channel.name, inline: true },
          { name: "Jump to Post", value: msg.url, inline: true },
          { name: "User", value: userBackup(user) }
        );
      if (msg.channel.parentId === u.sf.channels.minecraft.category) {
        msg.client.getTextChannel(u.sf.channels.minecraft.mods)?.send({
          embeds: [embed],
          components: [
            u.MessageActionRow()
              .addComponents([
                new u.Button().setCustomId("modCardCensor").setLabel("Censor").setEmoji("🤬").setStyle(Discord.ButtonStyle.Secondary)
              ])
          ]
        });
      }
    } else if (interaction) {
      embed.setTimestamp(interaction.createdAt)
        .setDescription("User Reported!")
        .addFields(
          { name: "Channel", value: `<#${interaction.channelId}>`, inline: true }
        );
    }
    if (snitch) {
      embed.addFields(
        { name: "Flagged By", value: userBackup(snitch), inline: true },
        { name: "Reason", value: flagReason, inline: true }
      );
      embed.setImage(msg?.attachments.at(0)?.url ?? null);
      if (furtherInfo) embed.addFields({ name: "Further Information", value: furtherInfo, inline: true });
    } else if (flagReason) {
      embed.addFields({ name: "Reason", value: flagReason });
    }

    embed.addFields({ name: `Infraction Summary (${infractionSummary.time} Days)`, value: `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}` });
    if (bot) embed.setFooter({ text: "The user is a bot and the flag likely originated elsewhere. No action will be processed." });

    /** @type {(string|undefined)[]} */
    const content = [];
    if (pingMods) {
      if (msg) u.clean(msg, 0);
      const ldsg = client.guilds.cache.get(u.sf.ldsg);
      if (isMember ? !member.roles.cache.has(u.sf.roles.moderation.muted) : true) {
        content.push(ldsg?.roles.cache.get(u.sf.roles.team.mod)?.toString());
      }
      if (bot) {
        content.push("The message has been deleted. The member was *not* muted, on account of being a bot.");
      } else {
        if (isMember && !member.roles?.cache.has(u.sf.roles.moderation.muted)) {
          await member.roles?.add(u.sf.roles.moderation.muted);
          if (member.voice?.channel) {
            member.voice?.disconnect("Auto-mute");
          }
          ldsg?.client.getTextChannel(u.sf.channels.mods.muted)?.send({
            content: `${member}, you have been auto-muted in ${msg?.guild.name ?? "LDS Gamers"}. Please review our ${code}. A member of the mod team will be available to discuss more details.`,
            allowedMentions: { users: [member.id] }
          });
        }
        content.push("The mute role has been applied and message deleted.");
      }
    }

    const card = await client.getTextChannel(u.sf.channels.mods.logs)?.send({
      content: content.join('\n'),
      embeds: [embed],

      components: ((bot || !msg) ? undefined : modActions),
      allowedMentions: { roles: [u.sf.roles.team.mod] }
    });

    if (!card) throw new Error("Card creation failed!");

    if (!bot && msg) {
      const infraction = {
        discordId: member.id,
        channel: msg.channel.id,
        message: msg.id,
        flag: card.id,
        description: msg.cleanContent || "No Content",
        mod: client.user?.id ?? "Icarus",
        value: 0
      };
      await u.db.infraction.save(infraction);
    }
    return card;
  },
  /**
   * Get a summary embed
   * @param {Discord.GuildMember|Discord.User} member
   * @param {number} [time]
   * @param {Discord.Guild | null} [guild]
   */
  getSummaryEmbed: async function(member, time, guild, getInfractions = true) {
    const isMember = member instanceof Discord.GuildMember;
    const data = await u.db.infraction.getSummary(member.id, time);
    const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
    if (getInfractions && (data.count > 0) && (data.detail.length > 0)) {
      data.detail = data.detail.reverse(); // Newest to oldest is what we want
      for (const record of data.detail) {
        const g = isMember ? member.guild : guild;
        const mod = g?.members.cache.get(record.mod);
        const handler = g?.members.cache.get(record.handler ?? "");
        const pointsPart = record.value === 0 && (mod?.id !== member.client.user.id) ? "Note" : `${record.value} pts`;
        response.push(`\`${record.timestamp.toLocaleDateString()}\` (${pointsPart}, Mod: ${mod || `Unknown Mod (<@${record.mod }>)`}${handler ? `, Handler: ${handler}` : ""}): ${record.description}`);
      }
    }

    let text = response.join("\n");
    text = text.length > 4090 ? text.substring(0, 4090) + "..." : text;

    const userDoc = await u.db.user.fetchUser(member.id);
    let roleString = isMember ? member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role).join(", ") : "[Unknown]";
    if (roleString.length > 1024) roleString = roleString.slice(0, 1020) + "...";

    const embed = u.embed({ author: member })
      .setTitle("Infraction Summary")
      .setColor(embedColors.info)
      .addFields(
        { name: "ID", value: member.id, inline: true },
        { name: "Joined", value: isMember ? member.joinedAt ? u.time(member.joinedAt, 'R') : "unknown" : "unknown", inline: true },
        { name: "Account Created", value: u.time((isMember ? member.user : member).createdAt, 'R'), inline: true },
        { name: "Roles", value: roleString },
      );
    if (getInfractions) {
      embed
        .setDescription(text)
        .addFields({ name: "Activity", value: `Chat: ${userDoc?.posts ?? "Unknown"} minutes\nVoice: ${userDoc?.voice ?? "Unknown"}`, inline: true });
    }
    return embed;

  },
  /**
   * They get the boot
   * @template {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString">} T
   * @param {T} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   * @returns {Promise<{ payload: Discord.InteractionEditReplyOptions | string, interaction: T | Discord.ButtonInteraction} | null>}
   */
  kick: async function(interaction, target, reason) {
    let success = false;
    let confirm;
    try {
      if (!compareRoles(interaction.member, target)) return { payload: `You have insufficient permissions to kick ${target}!`, interaction };
      else if (!target.kickable) return { payload: `I have insufficient permissions to kick ${target}!`, interaction };

      confirm = await u.confirmInteraction(interaction, `Kick ${target} for:\n${reason}?`, `Confirm Kick on ${u.escapeText(target.displayName)}`);
      if (!confirm) return null;

      if (!confirm) {
        return {
          payload: {
            embeds: [u.embed({ author: target }).setColor(embedColors.handled).setDescription(`Kick ${confirm === false ? "cancelled" : "timed out"}`)],
            components: []
          },
          interaction: confirm
        };
      }
      // The actual kick part
      const targetRoles = target.roles.cache.clone();
      await target.send({ content: messageFromMods, embeds: [
        u.embed()
        .setTitle("User Kick")
        .setDescription(`You have been kicked from ${interaction.guild.name}.`)
        .addFields({ name: "Details", value: reason })
        .setFooter({ text: `${interaction.member.displayName} has issued this kick.` })
      ] }).catch(() => blocked(target));

      await target.kick(reason);
      success = true;

      // Save infraction
      await u.db.infraction.save({
        discordId: target.id,
        description: `[User Kick]: ${reason}`,
        value: 30,
        mod: interaction.member.id
      });

      // Save roles
      targetRoles.delete(u.sf.roles.moderation.trusted);
      u.db.user.updateRoles(target, targetRoles.map(r => r.id));

      // Log it
      interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle(`👢 User Kick`)
          .addFields({ name: "Reason", value: reason })
          .setColor(embedColors.info)
      ] });
      return {
        payload: {
          embeds: [
            u.embed({ author: target })
            .setColor(embedColors.success)
            .setDescription(`${target} kicked for:\n${reason}`)
          ],
          components: []
        },
        interaction: confirm
      };
    } catch (error) {
      await u.errorHandler(error, interaction);
      return {
        payload: `I ran into an error! ${target} ` + (success ? "*was* kicked though." : "wasn't kicked."),
        interaction: confirm ?? interaction
      };
    }
  },

  /**
   * Prevent someone from talking
   * @param {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} [reason]
   */
  mute: async function(interaction, target, reason, apply = true) {
    const m = apply ? "mute" : "unmute";
    const M = apply ? "Mute" : "Unmute";
    let success = 0;
    try {
      if (!target.manageable) return `I have insufficient permissions to ${m} ${target}!`;

      // Don't mute if muted or vice versa
      if (target.roles.cache.has(u.sf.roles.moderation.muted) === apply) return `${target} is already ${m}d.`;

      // Impose Mute or Unmute
      if (apply) await target.roles.add(u.sf.roles.moderation.muted);
      else await target.roles.remove(u.sf.roles.moderation.muted);
      success = 1; // role changed

      // Disconnect from VC and mute (or unmute)
      if (apply && target.voice.channel) {
        await target.voice.disconnect(reason);
        await target.voice.setMute(true, reason);
      } else if (target.voice.channel) {
        await target.voice.setMute(false, reason);
      }
      success = 2; // vc status changed

      await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle(`${apply ? "🔇" : "🔊"} Member ${M}`)
          .addFields({ name: "Reason", value: reason ?? "[Not Provided]" })
          .setColor(embedColors.info)
      ] });

      if (apply) {
        await interaction.client.getTextChannel(u.sf.channels.mods.muted)?.send({ content:
          `${target}, you have been muted in ${interaction.guild.name}. `
        + `Please review our ${code}.\n`
        + 'A member of the mod team will be available to discuss more details.',
        allowedMentions: { parse: ["users"] } });
      }

      return `${M}d ${target}.`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error" + (
        success > 1 ? `, but ${target} *was* ${m}d and they're ${apply ? "not able" : "able"} to speak in voice channels.`
          : success > 0 ? `, but ${target} *was* ${m}d, but they may or may not be able to speak in voice channels.`
            : `! ${target} wasn't ${m}d and may or may not be able to speak in voice channels.`
      );
    }
  },

  /**
   * Write down a note on a user
   * @param {Augur.GuildInteraction<"CommandSlash"|"Modal">} interaction
   * @param {Discord.GuildMember|Discord.User} target
   * @param {string} note
   */
  note: async function(interaction, target, note) {
    let success = false;
    try {
      await u.db.infraction.save({
        discordId: target.id,
        value: 0,
        description: note,
        mod: interaction.user.id
      });
      success = true;
      const summary = await u.db.infraction.getSummary(target.id);

      await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle("🗒️ Note Created")
          .setColor(embedColors.info)
          .addFields(
            { name: "Note", value: note },
            { name: `Infraction Summary (${summary.time} Days)`, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` }
          )
      ] });

      return `Note added for ${target}.`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? "I *was* able to save the note though." : "I wasn't able to save the note");
    }
  },

  /**
   * Send someone to Ghost's Office
   * @param {Augur.GuildInteraction<"CommandSlash">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} reason
   */
  office: async function(interaction, target, reason, apply = true) {
    let success = false;
    try {
      const put = apply ? `put ${target} in` : `released ${target} from`;
      if (!target.manageable) return `I have insufficient permissions to ${put} the office!`;

      // don't do it if it wont do anything
      if (target.roles.cache.has(u.sf.roles.moderation.ductTape) === apply) return `${target} is ${apply ? "already" : "not"} in the office.`;

      // do it
      if (apply) await target.roles.add(u.sf.roles.moderation.ductTape);
      else await target.roles.remove(u.sf.roles.moderation.ductTape);
      success = true;

      // log it;
      await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle(`💼 Member ${apply ? "Sent to" : "Released from"} Office`)
          .addFields({ name: "Reason", value: reason ?? "[Not Provided]" })
          .setColor(embedColors.info)
      ] });

      if (apply) {
        await interaction.client.getTextChannel(u.sf.channels.mods.office)?.send({ content:
          `${target}, you have been sent to the office in ${interaction.guild.name}.\n`
          + 'This allows you and the mods to have a private space to discuss issues or concerns.\n'
          + `Please review our ${code}. A member of the mod team will be available to discuss more details.`,
        allowedMentions: { parse: ['users'] }
        });
      }

      return `${target} has been ${apply ? "sent to" : "released from"} the office!`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? "They *were* sent to the office though." : "They weren't sent to the office.");
    }
  },

  /**
   * Change someone's server nickname
   * @param {Augur.GuildInteraction<"CommandSlash"|"Modal">} interaction
   * @param {Discord.GuildMember} target
   * @param {string} newNick
   */
  rename: async function(interaction, target, newNick, reset = false) {
    let success = false;
    try {
      const oldNick = target.displayName;
      if (!target.manageable) return `I have insufficient permissions to rename ${target}!`;

      await target.setNickname(reset ? null : newNick);
      success = true;

      const comment = `Set nickname to ${u.escapeText(reset ? "default" : newNick)} from ${u.escapeText(oldNick)}.`;

      if (!reset) {
        await target.send(
          messageFromMods + `We have found that your ${oldNick === target.user.displayName ? "username" : "server nickname"} is in violation of our ${code}.\n`
          + `We've taken the liberty of setting a new server nickname (**${newNick}**) for you. Please reach out if you have any questions.`
        ).catch(() => blocked(target));
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

      interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [
        logEmbed(interaction, target)
          .setTitle("✏️ User Renamed")
          .setDescription(comment)
          .addFields(
            { name: "Name Change", value: `\`${u.escapeText(oldNick)}\` ⏭️ \`${u.escapeText(reset ? "default" : newNick)}\`` },
            { name: `Infraction Summary (${summary.time} Days) `, value: `Infractions: ${summary.count}\nPoints: ${summary.points}` }
          )
        .setColor(embedColors.info)
      ] });

      return `${target}'s nickname changed from ${u.escapeText(oldNick)} to ${u.escapeText(reset ? "default" : newNick)}.`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? "I *was* able to rename them though." : "I wasn't able to rename them.");
    }
  },

  /**
   * Delete spam messages similar to a given message
   * @param {string[]} searchContent
   * @param {Discord.Guild} guild
   * @param {Discord.Message<true>} message
   * @param {boolean} auto
   */
  spamCleanup: async function(searchContent, guild, message, auto = false) {
    const timeDiff = config.spamThreshold.cleanupLimit * (auto ? 1 : 2) * 1000;
    const contents = u.unique(searchContent);
    /** @type {Promise<Discord.Collection<Discord.Snowflake, Discord.Message | Discord.PartialMessage | undefined>>[]} */
    const promises = [];
    for (const [, channel] of guild.channels.cache) {
      const perms = channel.permissionsFor(message.client.user);
      if (!channel.isTextBased() || !perms?.has("ManageMessages") || !perms.has("ViewChannel") || !perms.has("Connect")) continue;
      const fetched = await channel.messages.fetch({ around: message.id, limit: 30 }).catch(u.noop);
      if (!fetched) return { deleted: 0, channels: [] };
      const messages = fetched.filter(m =>
        m.createdTimestamp <= (timeDiff + message.createdTimestamp) &&
        m.createdTimestamp >= (message.createdTimestamp - timeDiff) &&
        m.author.id === message.author.id &&
        contents.includes(m.content.toLowerCase())
      );
      if (messages.size > 0) promises.push(channel.bulkDelete(messages, true));
    }
    if (promises.length > 0) {
      const resolved = await Promise.all(promises);
      const deleted = resolved.flatMap(a => a.size).reduce((p, c) => p + c, 0);
      const channels = u.unique(resolved.flatMap(a => a.map(b => b?.channel.toString())));
      return { deleted, channels };
    }
    return null;

  },

  /**
   * Briefly prevent someone from talking
   * @param {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString">} interaction
   * @param {Discord.GuildMember} target
   * @param {number} time Minutes, default is 10
   * @param {string} [reason]
   */
  timeout: async function(interaction, target, time = 10, reason) {
    const apply = time > 0;
    const t = apply ? "time out" : "release";
    const td = apply ? "timed out" : "released";
    const T = apply ? "Timed Out" : "Released from Time Out";
    let success = false;
    try {
      if (!target.manageable) return `I have insufficient permissions to ${t} ${target}!`;

      // Don't mute if muted or vice versa
      if (!apply && !target.communicationDisabledUntil) return `${target} is already ${td}.`;

      // Impose Timeout
      await target.timeout(time * 60 * 1000 || null, reason);
      success = true; // role changed

      const embed = logEmbed(interaction, target)
        .setTitle(`${apply ? "⛔" : "✅"} User ${T}`)
        .addFields(
          { name: "Reason", value: reason ?? "[Not Provided]" },
          { name: "Time", value: `${time} minutes` }
        )
        .setColor(embedColors.info);

      if (apply) embed.addFields({ name: "Time", value: `${time} minutes` });

      await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });

      return `${target} has been ${td}${apply ? ` for ${time} minutes` : ""}.`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? `They *were* ${td} though.` : `I wasn't able to do the ${t}`);
    }
  },

  /**
   * Give someone the Trusted Role
   * @param {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString"|"Button">} interaction
   * @param {Discord.GuildMember} target
   */
  trust: async function(interaction, target, apply = true) {
    let success = false;
    try {
      if (target.roles.cache.has(u.sf.roles.moderation.trusted) === apply) return `${target} is ${apply ? "already trusted" : "not trusted yet"}!`;
      const embed = logEmbed(interaction, target).setColor(embedColors.info);
      if (apply) {
        await target.roles.add(u.sf.roles.moderation.trusted);
        success = true;
        target.send(
          "## Congratulations!\n"
          + `You have been marked as "Trusted" in ${interaction.guild.name} . `
          + "This means you are now permitted to post images and links in chat. "
          + `Please remember to follow our ${code} when doing so.\n\n`
          + "If you'd like to join one of our in-server Houses, you can visit <http://3houses.live> to get started!"
        ).catch(() => blocked(target));
        embed.setTitle("🤝 User Given Trusted");
      } else {
        await target.roles.remove([u.sf.roles.moderation.trusted, u.sf.roles.moderation.trustedPlus]);
        success = true;
        target.send(messageFromMods + `You have been removed from "Trusted" in ${interaction.guild.name}.\n`
          + "This means you no longer have the ability to post images. "
          + `Please remember to follow our ${code} when posting images or links in the future.\n`
        ).catch(() => blocked(target));
        embed.setTitle("💢 User Trust Removed");
      }
      await modCommon.watch(interaction, target, !apply);
      interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });
      return `${target} has been ${apply ? "given" : "removed from"} the Trusted role!`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return `I ran into an error! ${target}` + (success ? ` *was*${apply ? "" : " removed from"} Trusted though.` : "'s Trusted status didn't change.");
    }
  },

  /**
   * Give somebody a staff assigned role
   * @param {Augur.GuildInteraction<"CommandSlash"|"Button">} int
   * @param {Boolean} give
   * @param {Discord.GuildMember} recipient
   * @param {Discord.Role | string} role
   * @returns {Promise<string>}
   */
  assignRole: async function(int, recipient, role, give = true) {
    /** @param {Discord.GuildMember} member @param {string} id*/
    try {
      const pres = give ? "give" : "take";
      const past = give ? "gave" : "took";
      const id = typeof role === "string" ? role : role.id;
      const str = `<@&${id}>`;
      try {
        if (recipient.roles.cache.has(id) === give) return `${recipient} ${give ? "already has" : "doesn't have"} the ${str} role`;
        give ? await recipient?.roles.add(id) : await recipient?.roles.remove(id);
        const returnStr = `Successfully ${past} the ${str} role ${give ? "to" : "from"} ${recipient}`;
        const embed = u.embed({ author: recipient, color: 0x00ffff })
            .setTitle(`User ${give ? "added to" : "removed from"} ${typeof role === "string" ? "role" : role.name}`)
            .setDescription(`${userBackup(int.member)} ${past} the ${str} role ${give ? "to" : "from"} ${userBackup(recipient)}.`);
        int.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });
        return returnStr;
      } catch (e) { return `Failed to ${pres} ${recipient} the ${str} role`; }
    } catch (error) { u.errorHandler(error, int); }
    return "I could not find that role!";
  },

  /**
   * Give someone the Trusted+ Role
   * @param {Augur.GuildInteraction<"CommandSlash"|"SelectMenuString">} interaction
   * @param {Discord.GuildMember} target
   */
  trustPlus: async function(interaction, target, apply = true) {
    let success = false;
    try {
      if (target.roles.cache.has(u.sf.roles.moderation.trustedPlus) === apply) return `${target} ${apply ? "already has" : "doesn't have"} the Trusted+ role!`;
      if (apply && !target.roles.cache.has(u.sf.roles.moderation.trusted)) return `${target} needs the Trusted role before they can get the Trusted+ role!`;
      const embed = logEmbed(interaction, target).setColor(embedColors.info);

      if (apply) {
        await target.roles.add(u.sf.roles.moderation.trustedPlus);
        success = true;
        target.send(
          "## Congratulations!\n"
          + "You've been added to the Trusted+ list in LDSG, allowing you to stream to voice channels!\n\n"
          + `While streaming, please remember the Streaming Guidelines ( https://goo.gl/Pm3mwS ) and our ${code}.`
          + "Also, please be aware that LDSG may make changes to the Trusted+ list from time to time at its discretion."
        ).catch(() => blocked(target));
        embed.setTitle("🎥 User Given Trusted+");
      } else {
        await target.roles.remove(u.sf.roles.moderation.trustedPlus);
        success = true;
        target.send(messageFromMods +
          `You have been removed from "Trusted+" in ${interaction.guild.name}. `
          + "This means you no longer have the ability to stream video in the server. "
          + `Please remember to follow our ${code}.`
        ).catch(() => blocked(target));

        embed.setTitle("📤 User Trusted+ Removed");
      }
      interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });
      return `${target} has been ${apply ? "added to" : "removed from"} the Trusted+ role!`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return `I ran into an error! ${target}` + (success ? ` *was*${apply ? "" : " removed from"} Trusted+ though.` : "'s Trusted+ status didn't change.");
    }
  },

  /**
   * Add or remove someone from the watch list
   * @param {Discord.Interaction<"cached">|Discord.Message} interaction
   * @param {Discord.GuildMember|string} target
   * @param {boolean} apply
   */
  watch: async function(interaction, target, apply = true) {
    let success = true;
    try {
      if (typeof target !== 'string' && (target.user.bot)) return `${target} is a bot and shouldn't be watched.`;
      const id = typeof target === "string" ? target : target.id;
      const watchStatus = await u.db.user.fetchUser(id);
      if (apply && (watchStatus?.watching || modCommon.watchlist.has(id))) return `${target} was already on the watchlist!`;
      if (!apply && watchStatus && !watchStatus.watching && !modCommon.watchlist.has(id)) return `${target} wasn't on the watchlist. They might not have the trusted role.`;

      await u.db.user.update(id, { watching: apply });
      if (apply) modCommon.watchlist.add(id);
      else modCommon.watchlist.delete(id);
      success = true;

      if (typeof target !== 'string') {
        const watchLog = interaction.client.getTextChannel(u.sf.channels.mods.watchList);
        const notifDesc = [
          `Use </mod watch:${u.sf.commands.slashMod}> to remove them.`,
          `Use </mod watch:${u.sf.commands.slashMod}> to re-add them.`
        ];
        const embed = logEmbed(interaction, target)
          .setTitle(apply ? "Watching User 👀" : "Un-Watching User 💤")
          .setDescription(notifDesc[apply ? 0 : 1])
          .setColor(embedColors.info);
        watchLog?.send({ embeds: [embed] });
      }
      return `I'm${apply ? "" : " no longer"} watching ${target} ${apply ? "now :eyes:" : "anymore :zzz:"}.`;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? `They *were* ${apply ? "put on" : "taken off"} the watchlist though.` : `They weren't ${apply ? "put on" : "taken off"} the watch list.`);
    }
  },

  /**
   * Issue a warning to a user
   * @param {Discord.Interaction<"cached">} interaction
   * @param {string} reason
   * @param {number} value
   * @param {Discord.GuildMember} target
   * @param {Discord.Message} [message]
  */
  warn: async function(interaction, reason, value, target, message) {
    let success = false;
    try {
      const embed = logEmbed(interaction, target)
        .addFields(
          { name: "Warning", value: reason },
          { name: "Points", value: `${value}` }
        )
        .setColor(embedColors.handled)
        .setTimestamp();
      if (message?.cleanContent) embed.addFields({ name: "Message Content", value: message.cleanContent });
      const flag = await interaction.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed] });

      await u.db.infraction.save({
        discordId: target.id,
        value: value,
        message: message?.id,
        channel: message?.channel.id,
        description: reason ?? "",
        flag: flag?.id ?? "unknown",
        mod: interaction.member.id,
        handler: interaction.member.id
      });
      success = true;

      if (message) {
        const response = messageFromMods + modCommon.warnMessage(u.escapeText(interaction.member?.displayName ?? interaction.user.displayName)) + `\n\n**Reason:** ${reason}`;
        await target.send({ content: response, embeds: [u.msgReplicaEmbed(message)] }).catch(() => blocked(target));
      } else {
        await target.send(messageFromMods + `**${interaction.member.displayName}** has issued the following warning regarding your behavior or content you have posted:\n\n> ${reason}`);
      }

      const sum = await u.db.infraction.getSummary(target.id);
      embed.addFields({ name: `Infraction Summary (${sum.time} Days) `, value: `Infractions: ${sum.count}\nPoints: ${sum.points}` });

      flag?.edit({ embeds: [embed] });
      return `${target} has been warned **${value}** points for: \`${reason}\``;
    } catch (error) {
      await u.errorHandler(error, interaction);
      return "I ran into an error! " + (success ? "I *was* able to save the warning though." : "I wasn't able to save the warning.");
    }
  },
  /** @param {string} mod */
  warnMessage: function(mod) {
    return "We have received one or more complaints regarding content you posted.\n"
    + `We have reviewed the content in question and have determined, in our sole discretion, that it is against our ${code}.\n`
    + "This content was removed on your behalf. As a reminder, if we believe that you are frequently in breach of our Code of Conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n"
    + `**${mod}** has issued this warning.`;
  },
  /** @type {Set<string>} */
  watchlist: new Set(),
  /** @type {Discord.Collection<string, NodeJS.Timeout>} */
  grownups: new u.Collection()
};

module.exports = modCommon;
