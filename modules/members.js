const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js")

/** Creates the user embed - an embed that gives the user create/join times, roles, and avatar.
 * @param {Discord.GuildMember} member
 * @type {Discord.EmbedBuilder} 
 */
function newUserEmbed(member) {
  // member is type Discord.GuildMember
  let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  if (roleString.length > 1024) { roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + "..." }
  let embed = u.embed()
    .setTitle(u.escapeText(member.displayName))
    .addFields([
      { name: "ID", value: member.id },
      { name: "Joined", value: member.joinedAt.toUTCString() },
      { name: "Account Created", value: member.user.createdAt.toUTCString() },
      { name: "Roles", value: roleString }
    ])
    .setThumbnail(member.user.displayAvatarURL({ size: 32, dynamic: true }));

  return embed;
}

/** Creates a profile card - a PNG that contains some user information in a fun format!
 * 
 * @param {Discord.GuildMember} member 
 * @returns {Promise<Buffer>}
 */
async function makeProfileCard(member) {
  const badgeData = require("../utils/badges"),
    RankInfo = require("../utils/RankInfo"),
    Jimp = require("jimp");
  const badgePath = "./site/public/images/badges/";
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const card = await Jimp.read("./storage/background.jpg");

  const target = msg.mentions.members.first() || msg.member;

  const rank = await Module.db.user.findXPRank(target);
  const badges = badgeData(target.roles.cache);

  const avatar = await Jimp.read(target.user.displayAvatarURL({ size: 64, format: "png" }));

  card.blit(avatar, 8, 8)
    .print(font, 80, 8, target.displayName.replace(/[^\x00-\x7F]/g, ""), 212)
    .print(font, 80, 28, "Joined: " + target.joinedAt.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }), 212);

  let rankOffset = (rank.excludeXP ? 80 : 168);
  if (!rank.excludeXP) {
    let level = RankInfo.level(rank.totalXP);
    card.print(font, 8, 80, `Current Level: ${level} (${rank.totalXP.toLocaleString()} XP)`, 284)
      .print(font, 8, 100, `Next Level: ${RankInfo.minXp(level + 1).toLocaleString()} XP`, 284)
      .print(font, 8, 128, `Season Rank: ${rank.currentRank}/${msg.guild.memberCount}`, 138)
      .print(font, 154, 128, `Lifetime Rank: ${rank.lifeRank}/${msg.guild.memberCount}`, 138);
  }

  for (let i = 0; i < badges.length; i++) {
    let badge = await Jimp.read(badgePath + badges[i].image);
    // card.blit(badge.resize(48, 48), 10 + (58 * (i % 5)), rankOffset + (58 * Math.floor(i / 5)));
    card.blit(badge.resize(61, 61), 10 + (73 * (i % 4)), rankOffset + (73 * Math.floor(i / 4)));
  }

  card.crop(0, 0, 300, Math.min(rankOffset + 73 * Math.ceil((badges.length) / 4), 533));

  return await card.getBufferAsync(Jimp.MIME_PNG)
}

/** Returns user information.
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction
 * @param {Discord.GuildMember} user
 */
async function slashUserInfo(interaction, user) {
  // I get it's kinda badly named - it's a Member not a User - but this matches the command nomenclature.
  if (user) {
    await interaction.reply({ embed: newUserEmbed(user), disableEveryone: true })
  } else {
    await interaction.reply({ content: "I couldn't find that user. (Not sure how, sorry.)" })
  }

}

/** Returns the profile card of the mentioned user. Or the current user.
 * 
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction 
 * @param {Discord.GuildMember} user 
 */
async function slashUserProfile(interaction, user) {
  // Same user/member issues as before.
  if (user) {
    let card = await makeProfileCard(user)
    await interaction.reply({ files: [card] })
  } else {
    await interaction.reply({ content: "I couldn't find that user. (Not sure how, sorry.)" })
  }
}

/** Responds with the number of guild members, and how many are online.
 * 
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction
 */
async function slashLdsgMembers(interaction) {
  let online = i.guild.members.cache.filter((member) => member.presence.status != "offline")
  let response = `📈 **Members:**\n${i.guild.memberCount} Members\n${online.length} Online`
  await i.reply({ content: response });
}

/** The LDSG Member Spotlight!
 *  
 * It's in a reduced functionality mode since it's complicated to migrate, and it's not guaranteed that it will be used.
 * 
 * @param {Augur.GuildInteraction<"CommandSlash">} interaction 
 */
async function slashLdsgSpotlight(interaction) {
  await interaction.reply({ content: "[Take a look!](https://www.ldsgamers.com/community#member-spotlight)"})
}

const Module = new Augur.Module()
  .setInit(u.noop) // Change if needed, but I don't think it is
  .addInteraction({
    name: "user",
    id: u.sf.commands.slashUser,
    process: async (interaction) => {
      let subcommand = interaction.options.getSubcommand(true);
      let user = interaction.options.getMember() ?? interaction.member
      switch (subcommand) {
        case "info": await slashUserInfo(interaction, user); break;
        case "profile": await slashUserProfile(interaction, user); break;
      }
    }
  })
  .addInteraction({
    name: "ldsg",
    id: u.sf.commands.slashLdsg,
    process: async (interaction) => {
      let subcommand = interaction.options.getSubcommand(true)
      switch (subcommand) {
        case "members": await slashLdsgMembers(interaction); break;
        case "spotlight": await slashLdsgSpotlight(interaction); break;
      }
    }
  })