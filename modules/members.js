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
let font;

/**
 * Creates a profile card - a PNG that contains some user information in a fun format!
 * @param {Discord.GuildMember} member The member to create the profile card for.
 * @returns {Promise<Buffer|undefined>} File-like object to attach to your response.
 */
async function makeProfileCard(member) {
  try {
    const members = member.guild.members.cache;
    const rank = await u.db.user.getRank(member.id, members);

    const ICON_SIZE = 128;
    const ICON_PADDING = 10;
    const BG = 0xF4A460FF;
    const BORDER = 0x402a23FF;

    const WIDTH = (ICON_SIZE + ICON_PADDING) * 4 + ICON_PADDING;
    const card = new Jimp(WIDTH, 10000, BG);

    const badgeCubby = new Jimp(ICON_SIZE + ICON_PADDING * 2, ICON_SIZE + ICON_PADDING * 2, BORDER)
      .blit(new Jimp(ICON_SIZE, ICON_SIZE, BG), ICON_PADDING, ICON_PADDING);

    let h = 0;
    card.blit(new Jimp(WIDTH, ICON_PADDING, BORDER), 0, h, () => h += ICON_PADDING);

    const avatarImg = await Jimp.read(member.displayAvatarURL({ size: ICON_SIZE, extension: "png" }));
    const avatarCubby = badgeCubby.clone().blit(avatarImg.resize(ICON_SIZE, ICON_SIZE), ICON_PADDING, ICON_PADDING);

    const joined = u.moment(member.joinedAt).subtract(rank?.priorTenure ?? 0, "days");
    const now = u.moment();
    const years = now.diff(joined, "years");
    const days = now.subtract(years, "years").diff(joined, "days");
    const tenure = `Tenure: ${years > 0 ? `${years} year${years !== 1 ? "s" : ""}, ` : ""}${days} day${days !== 1 ? "s" : ""}`;

    // eslint-disable-next-line no-control-regex
    const name = member.displayName.replace(/[^\x00-\x7F]/g, "").substring(0, 24);

    const midpoint = Math.floor((ICON_SIZE - ICON_PADDING) / 4) - 32 + h;
    card.blit(avatarCubby.resize(ICON_SIZE, ICON_SIZE), 0, 0)
      .print(font, ICON_SIZE + ICON_PADDING, h + midpoint, name, () => h += (ICON_SIZE - ICON_PADDING) / 2 - ICON_PADDING)
      .blit(new Jimp(WIDTH, ICON_PADDING, BORDER), ICON_SIZE, h, () => h += ICON_PADDING)
      .print(font, ICON_SIZE + ICON_PADDING, h + midpoint, tenure, () => h += (ICON_SIZE - ICON_PADDING) / 2 - ICON_PADDING)
      .blit(new Jimp(WIDTH, ICON_PADDING, BORDER), ICON_SIZE, h, () => h += ICON_PADDING);

    if (rank) {
      h = ICON_SIZE + ICON_PADDING;
      const level = RankInfo.level(rank.totalXP);
      card.print(font, ICON_PADDING * 2, h, `Current Level: ${level} (${rank.totalXP.toLocaleString()} XP)`, () => h += 35)
        .print(font, ICON_PADDING * 2, h, `Next Level At: ${RankInfo.minXp(level + 1).toLocaleString()} XP`, () => h += ICON_PADDING + 35)
        .blit(new Jimp(WIDTH, ICON_PADDING, BORDER), 0, h, () => h += ICON_PADDING * 2)
        .print(font, ICON_PADDING * 2, h, `Season Rank:\n${rank.rank.season}/${member.guild.memberCount}`)
        .print(font, ICON_PADDING * 2 + 242, h, `Lifetime Rank:\n${rank.rank.lifetime}/${member.guild.memberCount}`, () => h += 64 + ICON_PADDING * 2);

      card.blit(new Jimp(WIDTH, ICON_PADDING, BORDER), 0, h);
    } else {
      h = ICON_SIZE - ICON_PADDING;
    }

    card.blit(new Jimp(ICON_PADDING, h, BORDER), 0, 0);
    card.blit(new Jimp(ICON_PADDING, h, BORDER), WIDTH - ICON_PADDING, 0);

    const badges = badgeUtils.getBadges(member.roles.cache);
    const extra = 4 - (badges.length % 4 || 4);
    for (let i = 0; i < extra; i++) {
      badges.push({ image: "", name: "", overrides: [], lore: "" });
    }

    const placement = ICON_PADDING * 1.5;

    for (let i = 0; i < badges.length; i++) {
      const b = badges[i];
      const badge = b.image ? await Jimp.read(`${config.badgePath}/${b.image}`) : new Jimp(1, 1, 0x00000000);

      badge.resize(ICON_SIZE - ICON_PADDING, ICON_SIZE - ICON_PADDING);
      const cubby = badgeCubby.clone().blit(badge, placement, placement);

      card.blit(cubby, ((ICON_SIZE + ICON_PADDING) * (i % 4)), h);
      if (i % 4 === 3) h += ICON_SIZE + ICON_PADDING;
    }

    h += ICON_PADDING;
    card.crop(0, 0, WIDTH, h);

    const output = new Jimp(card.getWidth() + 30, card.getHeight() + 30, member.displayHexColor)
      .blit(card, 15, 15);

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
    font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  })
  .addInteraction({
    name: "user",
    id: u.sf.commands.slashUser,
    onlyGuild: true,
    guildId: u.sf.ldsg,
    options: { registry: "slashUser" },
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

