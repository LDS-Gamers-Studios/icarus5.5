// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const Rank = require("../utils/rankInfo");

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
    await interaction.deferReply({ flags: ["Ephemeral"] });
    /** @type {keyof typeof import("../database/controllers/user").TrackXPEnum | null} */
    // @ts-ignore
    const track = interaction.options.getString("status");
    if (track === null) {
      const status = await u.db.user.fetchUser(interaction.user.id);
      return interaction.editReply(`You are currently ${status?.trackXP === u.db.user.TrackXPEnum.OFF ? "not " : ""}tracking XP${status?.trackXP === u.db.user.TrackXPEnum.FULL ? " with level up notifications" : ""}!`);
    }

    const enumed = u.db.user.TrackXPEnum[track] ?? u.db.user.TrackXPEnum.FULL;
    await u.db.user.update(interaction.user.id, { trackXP: enumed });
    const str = track === "FULL" ? "track your XP and notify you of level ups!" : track === "SILENT" ? "silently track your XP!" : "stop tracking your XP.";
    await interaction.editReply(`Ok! I'll ${str}`);
  } catch (error) { u.errorHandler(error, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashRankView(interaction) {
  try {
    // View member rankings
    await interaction.deferReply({ flags: u.ephemeralChannel(interaction) });
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
        { name: "Level", value: `Current Level: ${level}\nNext Level At: ${nextLevel} XP`, inline: true },
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
  // these two are technically xp related, but they're also mod related, and also rank related. This file is the least cluttered rn so I put them here
  .addInteraction({
    name: "timeModTrust",
    id: "timeModTrust",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["mod", "mgr"]),
    process: async (int) => {
      await int.deferReply({ flags: ["Ephemeral"] });
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
      await int.deferReply({ flags: ["Ephemeral"] });
      const userId = int.message.embeds[0]?.footer?.text;
      const target = int.guild.members.cache.get(userId ?? "0");
      if (!target) return int.editReply("I couldn't find that user!");
      const e = await c.getSummaryEmbed(target);
      return int.editReply({ embeds: [e] });
    }
  });


module.exports = Module;