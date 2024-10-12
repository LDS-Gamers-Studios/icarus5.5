// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  Rank = require("../utils/rankInfo"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon");

const active = new Set();

/**
 * @typedef Role
 * @prop {string} role
 * @prop {number} level
 */

/** @type {Discord.Collection<number, Role>} */
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

/** @param {Augur.AugurClient} client */
async function rankClockwork(client) {
  try {
    const response = await u.db.user.addXp([...active]);
    if (response.users.length > 0) {
      const ldsg = client.guilds.cache.get(u.sf.ldsg);
      for (const user of response.users) {
        const member = ldsg?.members.cache.get(user.discordId) ?? await ldsg?.members.fetch(user.discordId).catch(u.noop);
        if (!member) continue;
        try {
          // Remind mods to trust people!
          const trustStatus = await u.db.user.fetchUser(member.id);
          if ((user.posts % 25 === 0) && !member.roles.cache.has(u.sf.roles.trusted) && !trustStatus?.watching) {
            const modLogs = client.getTextChannel(u.sf.channels.modlogs);
            modLogs?.send({
              content: `${member} has had ${user.posts} active minutes in chat without being trusted!`,
              embeds: [
                u.embed({ author: member })
                  .setThumbnail(member.user.displayAvatarURL({ extension: "png" }))
                  .addFields(
                    { name: "ID", value: member.id, inline: true },
                    { name: "Activity", value: `Active Minutes: ${user.posts}`, inline: true },
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

          // Grant ranked rewards, if appropriate
          if (!user.excludeXP) {
            const lvl = Rank.level(user.totalXP);
            const oldLvl = Rank.level(user.totalXP - response.xp);

            if (lvl !== oldLvl) {
              let message = `${u.rand(Rank.messages)} ${u.rand(Rank.levelPhrase).replace("%LEVEL%", lvl.toString())}`;

              if (rewards.has(lvl)) {
                const reward = ldsg?.roles.cache.get(rewards.get(lvl)?.role ?? "");
                if (!reward) throw new Error(`Rank Role ${rewards.get(lvl)} couldn't be found!`);
                await member.roles.remove(rewards.map(r => r.role));
                await member.roles.add(reward);
                message += `\n\nYou have been awarded the **${reward.name}** role!`;
              }
              member.send(message).catch(u.noop);
            }
          }
        } catch (error) { u.errorHandler(error, `Member Rank processing (${member.displayName} - ${member.id})`); }
      }
    }
    active.clear();
  } catch (error) {
    u.errorHandler(error, "Rank inner clockwork");
  }
}

const Module = new Augur.Module()
.addInteraction({
  name: "rank",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashRank,
  options: { registry: "slashRank" },
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

.setInit(/** @param {Set<string>} talking */ async (talking) => {
  if (talking) {
    for (const user of talking) active.add(user);
  }
  const roles = u.db.sheets.roles.filter(r => r.type === "Rank").map(r => {
    return {
      role: r.base,
      level: parseInt(r.level)
    };
  });
  rewards = new u.Collection(roles.map(r => [r.level, r]));
})
.setUnload(() => active)
.addEvent("messageCreate", (msg) => {
  if (
    msg.inGuild() && msg.guild.id === u.sf.ldsg && // only in LDSG
    !active.has(msg.author.id) && // only if they're not already talking
    !(Rank.excludeChannels.includes(msg.channel.id) || Rank.excludeChannels.includes(msg.channel.parentId ?? "")) && // only if not in an excluded channel/category
    !msg.member?.roles.cache.hasAny(Rank.excludeRoles) && // only if they don't have an exclude role
    !msg.webhookId && !msg.author.bot && // only if its an actual user
    !u.parse(msg) // only if its not a command
  ) {
    active.add(msg.author.id);
  }
})
// @ts-ignore it works
.setClockwork(() => {
  try {
    return setInterval(rankClockwork, 60000, Module.client);
  } catch (error) {
    u.errorHandler(error, "Rank outer clockwork");
  }
});

module.exports = Module;
