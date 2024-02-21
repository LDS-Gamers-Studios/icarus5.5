const Augur = require("augurbot-ts"),
  Rank = require("../utils/rankInfo"),
  u = require("../utils/utils");

const active = new Set();

async function slashRankLeaderboard(interaction) {
  // View leaderboard
  try {
    await interaction.deferReply();

    const members = interaction.guild.members.cache;
    const leaderboard = await Module.db.user.getLeaderboard({
      members,
      member: interaction.member
    });

    const records = leaderboard.map(l => `${l.rank}: ${members.get(l.discordId).toString()} (${l.currentXP.toLocaleString()} XP)`);
    const embed = u.embed()
    .setTitle("LDSG Season Chat Leaderboard")
    .setThumbnail(interaction.guild.iconURL({ format: "png" }))
    .setURL("https://my.ldsgamers.com/leaderboard")
    .setDescription("Current season chat rankings:\n" + records.join("\n"))
    .setFooter({ text: "Use `/rank track` to join the leaderboard!" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashRankTrack(interaction) {
  // Set XP tracking
  try {
    await interaction.deferReply({ ephemeral: true });
    const track = interaction.options.getBoolean("choice");
    await Module.db.user.trackXP(interaction.user, track);
    await interaction.editReply({
      content: `Ok! I'll ${track ? "start" : "stop"} tracking your XP!`,
      ephemeral: true
    });
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashRankView(interaction) {
  try {
    // View member rankings
    await interaction.deferReply();
    const members = interaction.guild.members.cache;
    const member = interaction.options.getMember("user") ?? interaction.member;
    const record = await Module.db.user.getRank(member, members);

    if (record) {
      const level = Rank.level(record.totalXP);
      const nextLevel = Rank.minXp(level + 1).toLocaleString();

      const embed = u.embed({ author: member })
      .setTitle("LDSG Season Chat Ranking")
      .setURL("https://my.ldsgamers.com/leaderboard")
      .setFooter({ text: "https://my.ldsgamers.com/leaderboard" })
      .addFields(
        { name: "Rank", value: `Season: ${record.rank} / ${members.size}\nLifetime: ${record.lifetime} / ${members.size}`, inline: true },
        { name: "Level", value: `Current Level: ${level.toLocaleString()}\nNext Level: ${nextLevel} XP`, inline: true },
        { name: "Exp.", value: `Season: ${record.currentXP.toLocaleString()} XP\nLifetime: ${record.totalXP.toLocaleString()} XP`, inline: true }
      );

      await interaction.editReply({ embeds: [embed] });
    } else {
      const snark = [
        "don't got time for dat.",
        "ain't interested in no XP gettin'.",
        "don't talk to me no more, so I ignore 'em."
      ];
      await interaction.editReply(`**${member}** ${u.rand(snark)}\n(Try \`/rank track\` if you want to participate in chat ranks!)`);
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

async function rankClockwork(client) {
  try {
    const response = await Module.db.user.addXp(active);
    if (response.users.length > 0) {
      const ldsg = client.guilds.cache.get(u.sf.ldsg);
      for (const user of response.users) {
        const member = ldsg.members.cache.get(user.discordId) ?? await ldsg.members.fetch(user.discordId).catch(u.noop);
        if (!member) continue;

        try {
          // Remind mods to trust people!
          if ((user.posts % 25 == 0) && !member.roles.cache.has(u.sf.roles.trusted) && !member.roles.cache.has(u.sf.roles.untrusted)) {
            const modLogs = ldsg.channels.cache.get(u.sf.channels.modlogs);
            modLogs.send({
              content: `${member} has posted ${user.posts} times in chat without being trusted!`,
              embeds: [
                u.embed({ author: member })
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: "ID", value: member.id, inline: true },
                { name: "Activity", value: `Posts: ${user.posts}`, inline: true },
                { name: "Roles", value: member.roles.cache.map(r => r.name).join(", ") },
                { name: "Joined", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
              )
              ]
            });
          }

          // Grant ranked rewards, if appropriate
          if (!user.excludeXP) {
            const lvl = Rank.level(user.totalXP);
            const oldLvl = Rank.level(user.totalXP - response.xp);

            if (lvl != oldLvl) {
              let message = `${u.rand(Rank.messages)} ${u.rand(Rank.levelPhrase).replace("%LEVEL%", lvl)}`;

              if (Rank.rewards.has(lvl)) {
                const reward = ldsg.roles.cache.get(Rank.rewards.get(lvl).id);
                const roles = new Set(member.roles.cache.keys());
                for (const [, rewardInfo] of Rank.rewards) { roles.delete(rewardInfo.id); }
                roles.add(reward.id);
                await member.roles.set(Array.from(roles.values()));
                message += `\n\nYou have been awarded the ${reward.name} role!`;
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
  commandId: u.sf.commands.slashRank,
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);

      if (subcommand === "view") {
        await slashRankView(interaction);
      } else if (subcommand === "leaderboard") {
        await slashRankLeaderboard(interaction);
      } else if (subcommand === "track") {
        await slashRankTrack(interaction);
      } else {
        interaction.reply({
          content: "Well, this is embarrasing. I don't know what you asked for.",
          ephemeral: true
        });
        u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
})
.setInit((talking) => {
  if (talking) {
    for (const user of talking) active.add(user);
  }
})
.setUnload(() => active)
.addEvent("messageCreate", (msg) => {
  if (
    msg.guild?.id == u.sf.ldsg &&
    msg.author &&
    !active.has(msg.author.id) &&
    !(Rank.excludeChannels.includes(msg.channel.id) || Rank.excludeChannels.includes(msg.channel.parentId)) &&
    !msg.webhookId &&
    !u.parse(msg) &&
    !msg.author.bot
  ) {
    active.add(msg.author.id);
  }
})
.setClockwork(() => {
  try {
    return setInterval(rankClockwork, 60000, Module.client);
  } catch (error) {
    u.errorHandler(error, "Rank outer clockwork");
  }
});

module.exports = Module;
