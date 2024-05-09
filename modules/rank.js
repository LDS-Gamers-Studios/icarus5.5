// @ts-check
const Augur = require("augurbot-ts"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  Discord = require("discord.js"),
  Rank = require("../utils/rankInfo"),
  config = require('../config/config.json'),
  u = require("../utils/utils");

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
    if (track == null) {
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
    await interaction.deferReply({ ephemeral: interaction.channelId != u.sf.channels.botspam });
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
          if ((user.posts % 25 == 0) && !member.roles.cache.has(u.sf.roles.trusted) && !trustStatus?.watching) {
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
              ]
            });
          }

          // Grant ranked rewards, if appropriate
          if (!user.excludeXP) {
            const lvl = Rank.level(user.totalXP);
            const oldLvl = Rank.level(user.totalXP - response.xp);

            if (lvl != oldLvl) {
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
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
        case "view": return slashRankView(interaction);
        case "leaderboard": return slashRankLeaderboard(interaction);
        case "track": return slashRankTrack(interaction);
      }
    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
})

.setInit(/** @param {Set<string>} talking */ async (talking) => {
  if (talking) {
    for (const user of talking) active.add(user);
  }
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    /** @type {any[]} */
    // @ts-ignore cuz google sheets be dumb
    const roles = await doc.sheetsByTitle["Roles"].getRows();
    const a = roles.filter(r => r["Type"] == "Rank").map(r => {
      return {
        role: r["Base Role ID"],
        level: parseInt(r["Level"])
      };
    });

    rewards = new u.Collection(a.map(r => [r.level, r]));
  } catch (e) { u.errorHandler(e, "Load Rank Roles"); }
})
.setUnload(() => active)
.addEvent("messageCreate", (msg) => {
  if (
    msg.inGuild() && msg.guild.id == u.sf.ldsg && // only in LDSG
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
