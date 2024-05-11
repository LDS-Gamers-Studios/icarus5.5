// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js");

/** Creates the user embed - an embed that gives the user create/join times, roles, and avatar.
 * @param {Discord.GuildMember} member The member to create the embed for.
 * @returns {Discord.EmbedBuilder} An embed that represents the member.
 */
function newUserEmbed(member) {
  // member is type Discord.GuildMember
  let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  if (roleString.length > 1024) { roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + "..."; }
  const embed = u.embed()
    .setTitle(u.escapeText(member.displayName))
    .addFields([
      { name: "ID", value: member.id },
      { name: "Joined", value: (member.joinedAt ? u.time(member.joinedAt, 'F') : "???") },
      { name: "Account Created", value: u.time(member.user.createdAt, 'F') },
      { name: "Roles", value: roleString }
    ])
    .setThumbnail(member.displayAvatarURL({ forceStatic: false }));

  return embed;
}

/** Creates a profile card - a PNG that contains some user information in a fun format!
 *
 * @param {Discord.GuildMember} member The member to create the profile card for.
 * @returns {Promise<Buffer>} File-like object to attach to your response.
 */
async function makeProfileCard(member) {
  const badgeData = require("../utils/badges"),
    RankInfo = require("../utils/RankInfo"),
    Jimp = require("jimp");
  const badgePath = "./media/badges/";
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const card = await Jimp.read("./media/background.jpg");

  const members = member.guild.members.cache;
  const rank = await u.db.user.getRank(member.id, members);
  const badges = badgeData(member.roles.cache);

  const avatar = await Jimp.read(member.displayAvatarURL({ size: 64, extension: "png" }));

  card.blit(avatar, 8, 8)
    // eslint-disable-next-line no-control-regex
    .print(font, 80, 8, member.displayName.replace(/[^\x00-\x7F]/g, ""), 212)
    .print(font, 80, 28, "Joined: " + (member.joinedAt ? member.joinedAt.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }) : "???"), 212);

  const rankOffset = (!rank ? 80 : 168);
  if (rank) {
    const level = RankInfo.level(rank.totalXP);
    card.print(font, 8, 80, `Current Level: ${level} (${rank.totalXP.toLocaleString()} XP)`, 284)
      .print(font, 8, 100, `Next Level: ${RankInfo.minXp(level + 1).toLocaleString()} XP`, 284)
      .print(font, 8, 128, `Season Rank: ${rank.rank.season}/${member.guild.memberCount}`, 138)
      .print(font, 154, 128, `Lifetime Rank: ${rank.rank.lifetime}/${member.guild.memberCount}`, 138);
  }

  for (let i = 0; i < badges.length; i++) {
    const badge = await Jimp.read(badgePath + badges[i].image);
    // card.blit(badge.resize(48, 48), 10 + (58 * (i % 5)), rankOffset + (58 * Math.floor(i / 5)));
    card.blit(badge.resize(61, 61), 10 + (73 * (i % 4)), rankOffset + (73 * Math.floor(i / 4)));
  }

  card.crop(0, 0, 300, Math.min(rankOffset + 73 * Math.ceil((badges.length) / 4), 533));

  return await card.getBufferAsync(Jimp.MIME_PNG);
}

/** Returns user information.
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 * @param {Discord.GuildMember} user The user to get information for.
 */
async function slashUserInfo(interaction, user) {
  // I get it's kinda badly named - it's a Member not a User - but this matches the command nomenclature.
  try {
    if (user) {
      await interaction.reply({ embeds: [newUserEmbed(user).toJSON()] });
    } else {
      await interaction.reply({ content: "I couldn't find that user. (Not sure how, sorry.)" });
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

/** Returns the profile card of the mentioned user. Or the current user.
 *
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 * @param {Discord.GuildMember} user The user to get the profile card for.
 */
async function slashUserProfile(interaction, user) {
  // Same user/member issues as before.
  try {
    if (user) {
      const card = await makeProfileCard(user);
      await interaction.reply({ files: [card] });
    } else {
      await interaction.reply({ content: "I couldn't find that user. (Not sure how, sorry.)" });
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

const Module = new Augur.Module()
  .setInit(u.noop) // Change if needed, but I don't think it is
  .addInteraction({
    name: "user",
    id: u.sf.commands.slashUser,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true);
      const user = interaction.options.getMember("user") ?? interaction.member;
      switch (subcommand) {
      // @ts-ignore - LDSG will be cached and this function can only be run in a guild.
      case "info": await slashUserInfo(interaction, user); break;
      // @ts-ignore - LDSG will be cached and this function can only be run in a guild.
      case "profile": await slashUserProfile(interaction, user); break;
      // Side note, if you know partials well, can you make a type guard so TS is happy?
      }
    }
  });

module.exports = Module;
