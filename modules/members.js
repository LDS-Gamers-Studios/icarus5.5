// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  badgeUtils = require("../utils/badges"),
  RankInfo = require("../utils/rankInfo"),
  Jimp = require("jimp");

let font,
  /** @type {Jimp} */
  cardBackground;

/**
 * Creates a profile card - a PNG that contains some user information in a fun format!
 * @param {Discord.GuildMember} member The member to create the profile card for.
 * @returns {Promise<Buffer|undefined>} File-like object to attach to your response.
 */
async function makeProfileCard(member) {
  try {
    const card = cardBackground.clone();

    const members = member.guild.members.cache;
    const rank = await u.db.user.getRank(member.id, members);

    const avatar = await Jimp.read(member.displayAvatarURL({ size: 64, extension: "png" }));

    card.blit(avatar, 8, 8)
      // eslint-disable-next-line no-control-regex
      .print(font, 80, 8, member.displayName.replace(/[^\x00-\x7F]/g, ""), 212)
      .print(font, 80, 28, "Joined: " + (member.joinedAt ? u.moment(member.joinedAt).format("MMMM D, YYYY") : "???"), 212);

    const rankOffset = (rank ? 168 : 80);
    if (rank) {
      const level = RankInfo.level(rank.totalXP);
      card.print(font, 8, 80, `Current Level: ${level} (${rank.totalXP.toLocaleString()} XP)`, 284)
        .print(font, 8, 100, `Next Level: ${RankInfo.minXp(level + 1).toLocaleString()} XP`, 284)
        .print(font, 8, 128, `Season Rank: ${rank.rank.season}/${member.guild.memberCount}`, 138)
        .print(font, 154, 128, `Lifetime Rank: ${rank.rank.lifetime}/${member.guild.memberCount}`, 138);
    }

    const badges = badgeUtils.getBadges(member.roles.cache);
    const promises = badges.map(async (b, i) => {
      const badge = await Jimp.read(`./media/badges/${b.image}`);
      card.blit(badge.resize(61, 61), 10 + (73 * (i % 4)), rankOffset + (73 * Math.floor(i / 4)));
    });

    await Promise.all(promises); // Wait for all the blitting to be done

    card.crop(0, 0, 300, Math.min(rankOffset + 73 * Math.ceil((badges.length) / 4), 533));

    return await card.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    u.errorHandler(error, "Profile Card Failure");
  }
}

/**
 * Returns user information.
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction The interaction that the user submits.
 * @param {Discord.GuildMember} user The user to get information for.
 */
async function slashUserInfo(interaction, user) {
  const embed = await c.getSummaryEmbed(user, 0, interaction.guild, false);
  embed
  // un-mod-ifying it
    .setTitle(`About ${user.displayName}`)
    .setColor(parseInt(config.color));
  return interaction.reply({ embeds: [embed], ephemeral: interaction.channelId !== u.sf.channels.botspam });
}

/**
 * Returns the profile card of the mentioned user. Or the current user.
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction The interaction that the user submits.
 * @param {Discord.GuildMember} user The user to get the profile card for.
 */
async function slashUserProfile(interaction, user) {
  await interaction.deferReply({ ephemeral: interaction.channelId !== u.sf.channels.botspam });
  const card = await makeProfileCard(user);
  if (!card) return; // error handled
  return interaction.editReply({ files: [card] });
}

const Module = new Augur.Module()
  .setInit(async () => {
    font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    cardBackground = await Jimp.read("./media/background.jpg");
    await badgeUtils.getBadgeData();
  })
  .addInteraction({
    name: "user",
    id: u.sf.commands.slashUser,
    onlyGuild: true,
    guildId: u.sf.ldsg,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true);
      const user = interaction.options.getMember("user") ?? interaction.member;
      switch (subcommand) {
        case "info": await slashUserInfo(interaction, user); break;
        case "profile": await slashUserProfile(interaction, user); break;
        default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
      }
    }
  });

module.exports = Module;

