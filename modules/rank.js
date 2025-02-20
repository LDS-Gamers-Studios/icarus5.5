// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const Rank = require("../utils/rankInfo");
const fs = require("fs");

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
    await u.db.user.trackXP(interaction.user.id, enumed);
    const str = track === "FULL" ? "track your XP and notify you of level ups!" : track === "SILENT" ? "silently track your XP!" : "stop tracking your XP.";
    await interaction.editReply(`Ok! I'll ${str}`);
  } catch (error) { u.errorHandler(error, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashRankView(interaction) {
  try {
    // View member rankings
    await interaction.deferReply({ flags: (interaction.channelId !== u.sf.channels.botSpam ? ["Ephemeral"] : undefined) });
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
 * @param {Discord.Message<true>} msg
 * @param {string} suffix
*/
async function rankReset(msg, suffix) {
  try {
    msg.react("🥇").catch(u.noop);
    // useful vars. Dist should be 10_000 for a normal season length
    const ember = `<:ember:${u.sf.emoji.ember}>`;
    const dist = parseInt(suffix, 10) || 0;

    // get people who opted in to xp
    const members = await msg.guild.members.fetch().then(mems => mems.map(m => m.id));
    const users = await u.db.user.getUsers({ currentXP: { $gt: 0 }, discordId: { $in: members } });

    // log for backup
    fs.writeFileSync("./data/rankDetail-.json", JSON.stringify(users.map(usr => ({ discordId: usr.discordId, currentXP: usr.currentXP }))));

    // formula for ideal ember distribution
    const totalXP = users.reduce((p, cur) => p + cur.currentXP, 0);
    const rate = dist / totalXP;

    // top performers
    const medals = ["🥇", "🥈", "🥉"];
    const top3 = users.sort((a, b) => b.currentXP - a.currentXP)
      .slice(0, 3)
      .map((usr, i) => `${medals[i]} - <@${usr.discordId}>`)
      .join("\n");

    // in an ideal world this is if (true)
    if (dist) {
      const rewards = ["id,season,life,award"];
      // award ember to each user and log it in a csv
      for (const user of users) {
        const award = Math.round(rate * user.currentXP);
        if (award) {
          rewards.push(`${user.discordId},${user.currentXP},${user.totalXP},${award}`);
          u.db.bank.addCurrency({
            currency: "em",
            description: `Chat Rank Reset - ${new Date().toLocaleDateString()}`,
            discordId: user.discordId,
            value: award,
            giver: msg.client.user.id,
            otherUser: msg.client.user.id,
            hp: true
          });
        }
      }
      fs.writeFileSync("./data/awardDetail.csv", rewards.join("\n"));
    }

    // announce!
    let announcement = "# CHAT RANK RESET!!!\n\n" +
    `Another chat season has come to a close! In the most recent season, we've had **${users.length}** active members who are tracking their chatting XP! Altogether, we earned **${totalXP} XP!**\n` +
    `The three most active members were:\n${top3}`;
    if (dist > 0) {
      announcement += `\n\n${ember}${dist} have been distributed among *all* of those ${users.length} XP trackers, proportional to their participation.`;
    }
    announcement += "\n\nIf you would like to participate in this season's chat ranks and *haven't* opted in, `/rank track` will get you in the mix. If you've previously used that command, you don't need to do so again.";
    msg.client.getTextChannel(u.sf.channels.announcements)?.send({ content: announcement, allowedMentions: { parse: ["users"] } })
      .catch(() => msg.reply("I wasn't able to send the announcement!"));

    // set everyone's xp back to 0
    u.db.user.resetSeason();
  } catch (error) {
    u.errorHandler(error, msg);
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
  })
  .addCommand({ name: "rankreset",
    onlyGuild: true,
    permissions: (msg) => u.perms.calc(msg.member, ["mgr"]),
    process: rankReset
  });


module.exports = Module;