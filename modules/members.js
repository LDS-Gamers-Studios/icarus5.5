const Augur = require("augurbot-ts"),
u = require("../utils/utils"),
Discord = require("discord.js")

/** @type {Discord.EmbedBuilder} */
function newUserEmbed(member: Discord.GuildMember) {
  // member is type Discord.GuildMember
  let roleString = member.roles.cache.sort( (a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  if (roleString.length > 1024) {roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + "..."}
  let embed = u.embed()
    .setTitle(u.escapeText(member.displayName))
    .addFields([
      { name: "ID", value: member.id },
      { name: "Joined", value: member.joinedAt.toUTCString() },
      { name: "Account Created", value: member.user.createdAt.toUTCString() },
      { name: "Roles", value: "todo"}
    ])
    .setThumbnail(member.user.displayAvatarURL({ size: 32, dynamic: true }));

  return embed;
}

function temp_getonlineusers(i: Augur.GuildInteraction<"CommandSlash">) {
  let online = i.guild.members.cache.filter((member) => member.presence.status != "offline")
  let response = `✅ **Members:**\n${i.guild.memberCount} Members\n${online.length} Online`
}

const Module = new Augur.Module()
