// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const config = require("../config/config.json");
const c = require("../utils/modCommon");
const Rank = require("../utils/rankInfo");
const schedule = require("node-schedule");
const fs = require("fs");

const Module = new Augur.Module();

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

const rule = new schedule.RecurrenceRule();
rule.month = [0, 4, 8];
rule.date = 1;
rule.hour = 18;
rule.minute = 0;
rule.tz = "America/Denver";

/** @param {string} [time]  */
async function getMopBucketWinner(time) {
  const lastSeason = u.moment(time).startOf("month").subtract(4, "months").hour(19);

  const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't find LDSG - Rank Reset");

  const houses = [u.sf.roles.houses.housebb, u.sf.roles.houses.housefb, u.sf.roles.houses.housesc];
  /** @type {(keyof u["sf"]["emoji"]["houses"])[]} */
  const shorthand = ["bb", "fb", "sc"];

  const members = ldsg.members.cache.filter(m => m.roles.cache.hasAny(...houses));

  const awards = await u.db.bank.getPointAwards(members?.map(m => m.id) ?? [], lastSeason.valueOf());
  const points = houses.map((r, i) => {
    const role = ldsg.roles.cache.get(r);
    if (!role) throw new Error(`Couldn't find role ${r} - Rank Reset`);

    return {
      id: r,
      name: role.name,
      members: role.members.size,
      embers: 0,
      perCapita: 0,
      shorthand: shorthand[i],
      emoji: u.sf.emoji.houses[shorthand[i]]
    };
  });

  for (const award of awards) {
    const member = members.get(award.discordId);
    const house = points.find(p => member?.roles.cache.has(p.id));
    if (!member || !house) continue;

    house.embers += award.value;
  }

  for (const house of points) {
    house.perCapita = house.embers / house.members;
  }

  const medals = ["🥇", "🥈", "🥉"];

  points.sort((a, b) => b.embers - a.embers);
  const perHouse = points.map((house, i) => `${medals[i]} **${house.name}:** ${house.embers.toFixed(2)}`).join("\n");

  points.sort((a, b) => b.perCapita - a.perCapita);
  const perCapita = points.map((house, i) => `${medals[i]} **${house.name}:** ${house.perCapita.toFixed(2)}`).join("\n");

  const winner = points[0];
  const emoji = `<:${winner.shorthand}:${winner.emoji}>`;
  const publicString = "And now, for the winner of this season's **House Mop Bucket!!!**\n\n" +
    "This season's mop bucket goes to...\ndrumroll please...\n\n" +
    `# ${emoji} ${winner.name.toUpperCase()}!!! ${emoji}\n` +
    "-# Wow, incredible!\n\n" +
    `Congrats to all of you ${winner.name}-ers out there! Your house crest will be the server banner for a while, plus you get insane bragging rights!`;

  const privateEmbed = u.embed()
    .setTitle(`House Points Since ${lastSeason.format("MMMM Do")}`)
    .setDescription("Final standings of the houses this season (*decided by per capita*):\n\nPer Capita:\n" + perCapita + "\n\nPer House:\n" + perHouse);

  return { publicString, privateEmbed, house: winner };
}

async function rankReset() {
  try {
    // useful vars. Dist should be 10_000 for a normal season length
    const ember = `<:ember:${u.sf.emoji.ember}>`;
    const dist = 10_000;

    // get people who opted in to xp
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("No LDSG - Rank Reset");

    const members = await ldsg.members.fetch().then(mems => mems.map(m => m.id));
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
      .map((usr, i) => `${medals[i]} - <@${usr.discordId}> (${usr.currentXP} XP)`)
      .join("\n");

    const team = Module.client.getTextChannel(u.sf.channels.team.team);
    await team?.send(`Here are the stats for this season:\nParticipants: ${users.length}\nTotal XP: ${totalXP}\nRate: ${rate}\n\nTop 3:\n${top3}`);

    // generate CSV backup
    const rewardRows = ["id,season,life,award"];
    /** @type {import("../database/controllers/bank").CurrencyRecord[]} */

    const records = [];
    for (const user of users) {
      const award = Math.round(rate * user.currentXP);
      if (award) {
        rewardRows.push(`${user.discordId},${user.currentXP},${user.totalXP},${award}`);
        records.push({
          currency: "em",
          description: `Chat Rank Reset - ${new Date().toLocaleDateString()}`,
          discordId: user.discordId,
          value: award,
          giver: Module.client.user?.id ?? "Icarus",
          otherUser: Module.client.user?.id ?? "Icarus",
          hp: true,
          timestamp: new Date()
        });
      }

      if (records.length > 0) await u.db.bank.addManyTransactions(records);
      fs.writeFileSync("./data/awardDetail.csv", rewardRows.join("\n"));
    }

    // announce!
    let announcement = "# CHAT RANK RESET!!!\n\n" +
      `Another chat season has come to a close! In the most recent season, we've had **${users.length}** active members who are tracking their chatting XP! Altogether, we earned **${totalXP} XP!**\n` +
      `The three most active members were:\n${top3}\n\n` +
      `${ember}${dist} have been distributed among *all* of those ${users.length} XP trackers, proportional to their participation.\n\n` +
      "If you would like to participate in this season's chat ranks and *haven't* opted in, `/rank track` will get you in the mix. If you've previously used that command, you don't need to do so again.";

    const mopBucket = await getMopBucketWinner();
    announcement += `\n\n${mopBucket.publicString}`;

    Module.client.getTextChannel(u.sf.channels.announcements)?.send({ content: announcement, allowedMentions: { parse: ["users"] } });
    team?.send({ embeds: [mopBucket.privateEmbed] });

    // set everyone's xp back to 0
    u.db.user.resetSeason();
  } catch (error) {
    u.errorHandler(error, "Rank Reset");
  }
}

Module
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
  })
  .setInit(() => {
    schedule.scheduleJob("rankReset", rule, rankReset);
  })
  .addCommand({
    name: "debugcup",
    permissions: () => config.devMode,
    process: async () => {
      rankReset();
    }
  })
  .setUnload(() => {
    const canceled = schedule.cancelJob("rankReset");
    console.log(canceled);
  });


module.exports = Module;