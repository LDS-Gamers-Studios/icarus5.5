// @ts-check
const Discord = require("discord.js");
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const Rank = require("../utils/rankInfo");

/** @type {Set<string>} */
// [🥴,😬,🤷‍♂️] Some emoji aren't allowed
let bannedEmoji = new Set();

/** @type {Discord.Collection<string, Set<string>>} */
// [[id, [🤩,🥰,😻]]] These reactions are worth more in specific channels, like #pet-ownership would prefer cute reactions
let channelEmojiBoost = new u.Collection();

/** @type {Discord.Collection<string, number>} */
// [id, multiplier] Some channels are worth more xp than default, but others are worth less
let postMultipliers = new u.Collection();

/** @type {Set<string>} */
// [id, multiplier] Some channels prefer media over conversation
let mediaMultipliers = new Set();

/** @type {Set<string>} */
// There can be "channel of the week" style events, where that channel is worth more xp
const highlights = new Set();

/** @type {Discord.Collection<string, any[]>} */
// people can buy and place xp lures that work similar to the ones in pokemon go
const lures = new u.Collection();

/**
 * @typedef ActiveUser
 * @prop {number} multiplier
 * @prop {string} channelId
 * @prop {string} discordId
 * @prop {boolean} isVoice
 * @prop {boolean} isMessage
 */
/** @type {Discord.Collection<string, ActiveUser[]>} */
// people getting xp
const active = new u.Collection();

/** @type {Discord.Collection<number, {role: string, level: number}>} */
// rank level up rewards
let rewards = new u.Collection();

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashRankLeaderboard(interaction) {
  try {
    await interaction.deferReply();
    const lifetime = interaction.options.getBoolean("lifetime") ?? false;
    const memberIds = interaction.guild.members.cache;
    const leaderboard = await u.db.user.getLeaderboard({
      memberIds,
      member: interaction.member.id,
      season: !lifetime
    });
    const records = leaderboard.map(l => `${l.rank}: ${memberIds.get(l.discordId)} (${(lifetime ? l.totalXP : l.currentXP ?? 0)} XP)`);
    const embed = u.embed()
      .setTitle(`LDSG ${lifetime ? "Lifeteime" : "Season"} Chat Leaderboard`)
      .setThumbnail(interaction.guild.iconURL({ extension: "png" }))
      .setURL("https://my.ldsgamers.com/leaderboard")
      .setDescription(`${lifetime ? "Lifetime" : "Current season"} chat rankings:\n`
        + records.join("\n")
        + `\n\nUse </rank track:${u.sf.commands.slashRank}> to join the leaderboard!`
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) { u.errorHandler(error, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashRankTrack(interaction) {
  // Set XP tracking
  try {
    await interaction.deferReply({ ephemeral: true });
    const track = interaction.options.getBoolean("choice");
    if (track === null) {
      const status = await u.db.user.fetchUser(interaction.user.id);
      return interaction.editReply(`You are currently ${status?.excludeXP ? "not " : ""}tracking XP!`);
    }
    await u.db.user.trackXP(interaction.user.id, track);
    await interaction.editReply(`Ok! I'll ${track ? "start" : "stop"} tracking your XP!`);
  } catch (error) { u.errorHandler(error, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashRankView(interaction) {
  try {
    // View member rankings
    await interaction.deferReply({ ephemeral: interaction.channelId !== u.sf.channels.botspam });
    const members = interaction.guild.members.cache;
    const member = interaction.options.getMember("user") ?? interaction.member;
    const record = await u.db.user.getRank(member.id, members);

    if (record) {
      const level = Rank.level(record.totalXP);
      const nextLevel = Rank.minXp(level + 1);

      const embed = u.embed({ author: member })
      .setTitle("LDSG Season Chat Ranking")
      .setURL("https://my.ldsgamers.com/leaderboard")
      .setFooter({ text: "https://my.ldsgamers.com/leaderboard" })
      .addFields(
        { name: "Rank", value: `Season: ${record.rank.season} / ${members.size}\nLifetime: ${record.rank.lifetime} / ${members.size}`, inline: true },
        { name: "Level", value: `Current Level: ${level}\nNext Level: ${nextLevel} XP`, inline: true },
        { name: "Exp.", value: `Season: ${record.currentXP} XP\nLifetime: ${record.totalXP} XP`, inline: true }
      );

      await interaction.editReply({ embeds: [embed] });
    } else {
      const snark = [
        "don't got time for dat.",
        "ain't interested in no XP gettin'.",
        "don't talk to me no more, so I ignore 'em."
      ];
      await interaction.editReply(`**${member}** ${u.rand(snark)}\n(Try </rank track:${u.sf.commands.slashRank}> if you want to participate in chat ranks!)`).then(u.clean);
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

/**
 * @param {string} discordId
 * @param {number} multiplier
 * @param {string} channelId
 * @param {boolean} isVoice
 * @param {boolean} isMessage
 */
function addXp(discordId, multiplier, channelId, isVoice = false, isMessage = false) {
  /** @type {ActiveUser} */
  const obj = { multiplier, channelId, discordId, isVoice, isMessage };
  active.ensure(discordId, () => []).push(obj);
  return obj;
}

/**
 * @param {Discord.PartialMessageReaction | Discord.MessageReaction} reaction
 * @param {Discord.User | Discord.PartialUser} user
 * @param {Boolean} add
 */
async function reactionXp(reaction, user, add = true) {
  await reaction.message.fetch();
  await reaction.message.member?.fetch();
  // no fun for the bots
  if (user.bot || user.system || reaction.message.author?.bot || reaction.message.author?.system) return;
  // no reacting to yourself
  if (user.id === (reaction.message.author?.id ?? "")) return;
  // check if custom id, then check if unicode emoji
  const identifier = reaction.emoji.id ?? reaction.emoji.name ?? "";
  // some reactions don't give XP, usually negative ones
  if (bannedEmoji.has(identifier)) return null;
  // more reactions means more xp for the poster. Add 1 in the event of a removal
  const countMultiplier = (((await reaction.users.fetch()).size + (add ? 0 : 1)) * 0.7) + 1;
  // voice channel IDs aren't very helpful since they get replaced, so we use Voice instead
  const channelId = reaction.message.channel.type === Discord.ChannelType.GuildVoice ? "Voice" : reaction.message.channelId;
  // general multipliers
  // some emoji are worth more in certain channels
  const channelEmoji = channelEmojiBoost.get(channelId)?.has(identifier) ? 1.5 : 1;
  const recipient = 0.5 * countMultiplier * channelEmoji * (add ? 1 : -1);
  const giver = 0.5 * channelEmoji * (add ? 1 : -1);
  // add the xp to the queue
  addXp(user.id, giver, channelId);
  addXp(reaction.message.author?.id ?? "", recipient, channelId);
  return { recipient, giver };
}

/** @param {Augur.AugurClient} client */
async function rankClockwork(client) {
  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't get LDSG - Rank Clockwork");
  // give xp to people active in voice chats
  ldsg.members.cache.filter(m => m.voice.channel && !m.voice.mute && !m.voice.deaf)
    .forEach(m => {
      // vcs get deleted, stage channels don't
      const channelId = m.voice.channel?.type === Discord.ChannelType.GuildVoice ? "Voice" : m.voice.channelId ?? "";
      return addXp(m.id, 1, channelId, true);
    });
  // no reason to do anything
  if (active.size === 0) return;
  // hand out rewards and reset
  const backupActive = active.clone();
  active.clear();
  const response = await u.db.user.addXp(backupActive);
  if (response.users.length > 0) {
    for (const user of response.users) {
      const member = ldsg.members.cache.get(user.discordId) ?? await ldsg.members.fetch(user.discordId).catch(u.noop);
      if (member) {
        try {
          // Remind mods to trust people!
          if (member.roles.cache.has(u.sf.roles.trusted)) continue;
          let content;
          // they posted a message
          if (user.posts % 25 === 0 && backupActive.get(user.discordId)?.find(v => v.isMessage)) {
            content = `${user.posts} active minutes in chat`;
          // they were active in vc
          } else if (user.voice % 120 === 0 && backupActive.get(user.discordId)?.find(v => v.isVoice)) {
            content = `${user.voice} active minutes in voice chats`;
          }

          if (content) {
            client.getTextChannel(u.sf.channels.modlogs)?.send({
              content: `${member} has had ${content} without being trusted!`,
              embeds: [
                u.embed({ author: member })
                  .setThumbnail(member.user.displayAvatarURL({ extension: "png" }))
                  .addFields(
                    { name: "ID", value: member.id, inline: true },
                    { name: "Activity", value: `Chat: ${user.posts} minutes\nVoice: ${user.voice} minutes`, inline: true },
                    { name: "Roles", value: member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(r => r).join(", ") },
                    { name: "Joined", value: u.time(new Date(Math.floor(member.joinedTimestamp ?? 1)), "R") },
                    { name: "Account Created", value: u.time(new Date(Math.floor(member.user.createdTimestamp)), 'R') }
                  )
                  .setFooter({ text: member.id })
              ],
              components: [
                u.MessageActionRow().addComponents(
                  new u.Button().setCustomId("timeModTrust").setEmoji("👍").setLabel("Give Trusted").setStyle(Discord.ButtonStyle.Success),
                  new u.Button().setCustomId("timeModInfo").setEmoji("👤").setLabel("User Info").setStyle(Discord.ButtonStyle.Secondary)
                )
              ]
            });
          }

          // Grant ranked rewards if applicable
          if (!user.excludeXP) {
            const lvl = Rank.level(user.totalXP);
            const oldLvl = Rank.level(user.totalXP - (response.xp * (backupActive.get(user.discordId)?.reduce((p, cur) => p * cur.multiplier, 1) ?? 1)));

            if (lvl > oldLvl) {
              let message = `${u.rand(Rank.messages)} ${u.rand(Rank.levelPhrase).replace("%LEVEL%", lvl.toString())}`;

              if (rewards.has(lvl)) {
                const reward = ldsg.roles.cache.get(rewards.get(lvl)?.role ?? "");
                if (!reward) throw new Error(`Rank Role ${rewards.get(lvl)} couldn't be found!`);
                await member.roles.remove(rewards.map(r => r.role).filter(r => member.roles.cache.has(r)));
                await member.roles.add(reward);
                message += `\n\nYou have been awarded the **${reward.name}** role!`;
              }
              member.send(message).catch(u.noop);
            }
          }
        } catch (error) {
          u.errorHandler(error, `Member Rank processing (${member.displayName} - ${member.id})`);
        }
      }
    }
  }
}


const Module = new Augur.Module()
  .addInteraction({ id: u.sf.commands.slashRank,
    guildId: u.sf.ldsg,
    onlyGuild: true,
    process: async (interaction) => {
      try {
        const subcommand = interaction.options.getSubcommand(true);
        switch (subcommand) {
          case "view": return slashRankView(interaction);
          case "leaderboard": return slashRankLeaderboard(interaction);
          case "track": return slashRankTrack(interaction);
          default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
        }
      } catch (error) {
        u.errorHandler(error, interaction);
      }
    }
  })
  .addInteraction({
    name: "timeModTrust",
    id: "timeModTrust",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["mod", "mgr"]),
    process: async (int) => {
      await int.deferReply({ ephemeral: true });
      const userId = int.message.embeds[0]?.footer?.text;
      const target = int.guild.members.cache.get(userId ?? "0");
      if (!target) return int.editReply("I couldn't find that user!");
      const response = await c.trust(int, target, true);
      return int.editReply(response);
    }
  })
  .addInteraction({
    name: "timeModInfo",
    id: "timeModInfo",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["mod", "mgr"]),
    process: async (int) => {
      await int.deferReply({ ephemeral: true });
      const userId = int.message.embeds[0]?.footer?.text;
      const target = int.guild.members.cache.get(userId ?? "0");
      if (!target) return int.editReply("I couldn't find that user!");
      const e = await c.getSummaryEmbed(target);
      return int.editReply({ embeds: [e] });
    }
  })
  .setInit(/** @param {Discord.Collection<string, ActiveUser[]>} [talking] */ async (talking) => {
    if (talking) {
      for (const [id, user] of talking) active.set(id, user);
    }
    // set rank roles
    const roles = u.db.sheets.roles.filter(r => r.type === "Rank").map(r => {
      return {
        role: r.base,
        level: parseInt(r.level)
      };
    });
    rewards = new u.Collection(roles.map(r => [r.level, r]));

    // set banned emoji
    bannedEmoji = u.db.sheets.xpSettings.banned;
    // set multipliers
    channelEmojiBoost = new u.Collection(
      u.db.sheets.xpSettings.channels.filter(ch => ch.emoji.size > 0).map(ch => [ch.channelId, ch.emoji])
    );
    postMultipliers = new u.Collection(
      u.db.sheets.xpSettings.channels.filter(ch => ch.posts !== 1).map(ch => [ch.channelId, ch.posts])
    );
    mediaMultipliers = new Set(
      u.db.sheets.xpSettings.channels.filter(ch => ch.preferMedia).map(ch => ch.channelId)
    );

  })
  .setUnload(() => active)
  .addEvent("messageReactionAdd", (reaction, user) => reactionXp(reaction, user, true))
  .addEvent("messageReactionRemove", (reaction, user) => reactionXp(reaction, user, false))
  .addEvent("messageCreate", (msg) => {
    // no fun for bots
    if (msg.author.bot || msg.author.system || msg.webhookId) return;
    // different multipliers for different channels
    const channelMultiplier = postMultipliers.get(msg.channelId) ?? 1;
    const mediaMultiplier = (msg.attachments.size * (mediaMultipliers.has(msg.channelId) ? 0.3 : 0)) + 1;
    const highlight = highlights.has(msg.channelId) ? 1.3 : 1;
    const lure = ((lures.get(msg.channelId)?.length ?? 0) * 0.1) + 1;
    const multiplier = channelMultiplier * mediaMultiplier * highlight * lure;
    // add the xp if they haven't sent a message
    if (!active.get(msg.author.id)?.find(a => a.isMessage)) addXp(msg.author.id, multiplier, msg.channelId, false, true);
  })
  // xp for poll votes
  .addEvent("messageUpdate", async (msg, newMsg) => {
    // not allowed in VCs
    if (msg.poll && !msg.poll.resultsFinalized && newMsg.poll?.resultsFinalized && msg.channel.type !== Discord.ChannelType.GuildVoice) {
      const sorted = [...newMsg.poll.answers.values()].sort((a, b) => b.voteCount - a.voteCount);
      for (let i = 0; i < sorted.length; i++) {
        const answer = sorted[i];
        if (answer.voteCount === 0) continue;
        const people = await answer.fetchVoters();
        for (const [id, user] of people) {
          if (!user.bot && !user.system) addXp(id, i === 0 ? 2 : 1, msg.channelId);
        }
      }
    }
  })
  // @ts-ignore it works
  .setClockwork(() => {
    try {
      return setInterval(rankClockwork, 60_000, Module.client);
    } catch (error) {
      u.errorHandler(error, "Rank outer clockwork");
    }
  });

module.exports = Module;