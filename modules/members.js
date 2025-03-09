// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  badgeUtils = require("../utils/badges"),
  RankInfo = require("../utils/rankInfo"),
  Jimp = require("jimp");

/** @type {import("@jimp/plugin-print").Font} */
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
    const card = new Jimp(700, 10000, 0x00000000);

    const members = member.guild.members.cache;
    const rank = await u.db.user.getRank(member.id, members);

    const ICON_SIZE = 128;

    const avatar = await Jimp.read(member.displayAvatarURL({ size: ICON_SIZE, extension: "png" }));

    card.blit(avatar.resize(ICON_SIZE, ICON_SIZE), 8, 8)
      // eslint-disable-next-line no-control-regex
      .print(font, ICON_SIZE + 16, 18, member.displayName.replace(/[^\x00-\x7F]/g, "").substring(0, 24))
      .print(font, ICON_SIZE + 16, 58, "Joined: " + (member.joinedAt ? u.moment(member.joinedAt).format("MMMM D, YYYY") : "???"));

    const rankOffset = (rank ? 350 : 80);
    if (rank) {
      const level = RankInfo.level(rank.totalXP);
      card.print(font, 8, ICON_SIZE / 2 + 80, `Current Level: ${level} (${rank.totalXP.toLocaleString()} XP)`)
        .print(font, 8, ICON_SIZE / 2 + 120, `Next Level: ${RankInfo.minXp(level + 1).toLocaleString()} XP`)
        .print(font, 8, ICON_SIZE / 2 + 168, `Season Rank:\n${rank.rank.season}/${member.guild.memberCount}`)
        .print(font, 250, ICON_SIZE / 2 + 168, `Lifetime Rank:\n${rank.rank.lifetime}/${member.guild.memberCount}`);
    }

    const badges = badgeUtils.getBadges(member.roles.cache);
    const promises = badges.map(async (b, i) => {
      const badge = await Jimp.read(`${config.badgePath}/${b.image}`);
      badge.resize(128, 128);
      card.blit(badge, ((128 + 15) * (i % 4)), rankOffset + ((128 + 15) * Math.floor(i / 4)));
    });

    await Promise.all(promises); // Wait for all the blitting to be done

    card.autocrop();
    const output = cardBackground.clone()
      .resize(800, Jimp.AUTO)
      .blit(card, 15, 20)
      .crop(0, 0, card.getWidth() + 30, card.getHeight() + 60);

    return output.getBufferAsync(Jimp.MIME_PNG);
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
  return interaction.reply({ embeds: [embed], flags: u.ephemeralChannel(interaction) });
}

/**
 * Returns the profile card of the mentioned user. Or the current user.
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction The interaction that the user submits.
 * @param {Discord.GuildMember} user The user to get the profile card for.
 */
async function slashUserProfile(interaction, user) {
  await interaction.deferReply({ flags: u.ephemeralChannel(interaction) });
  const card = await makeProfileCard(user);
  if (!card) return; // error handled
  return interaction.editReply({ files: [card] });
}

const Module = new Augur.Module()
  .setInit(async () => {
    font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    cardBackground = await Jimp.read("./media/background.jpg");
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

