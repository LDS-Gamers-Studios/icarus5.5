// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  config = require('../config/config.json'),
  /** @type {string[]} */
  banned = require("../data/banned.json").features.welcome;

const mutedPerms = {
  // text
  ViewChannel: false,
  AddReactions: false,
  SendMessages: false,
  ReadMessageHistory: false,
  // voice
  Connect: false,
  Speak: false,
  Stream: false
};

let lowBoosts = false;
const tier3 = 14;

/**
 * @typedef Sponsor
 * @prop {string} Sponsor The sponsor's ID
 * @prop {string} Channel The sponsor's channel ID
 * @prop {string} Emoji The sponsor's reaction emoji ID
 */
// roles that SHOULD NOT be given when a user rejoins
const dangerRoles = [
  ...Object.values(u.sf.roles.team).filter(sf => ![u.sf.roles.team.botTeam, u.sf.roles.team.emeritus].includes(sf)),
  u.sf.roles.live, u.sf.roles.houses.head, u.sf.roles.houses.emberGuardian,
];

/**
 * Log user updates
 * @param {Discord.GuildMember | Discord.PartialGuildMember | Discord.User | Discord.PartialUser} oldUser
 * @param {Discord.GuildMember | Discord.User} newUser
 */
async function update(oldUser, newUser) {
  try {
    const ldsg = newUser.client.guilds.cache.get(u.sf.ldsg);
    const newMember = ldsg?.members.cache.get(newUser.id);
    if (oldUser.partial) oldUser = await oldUser.fetch().catch(() => oldUser);
    if (oldUser.partial) return; // failed to fetch
    const user = await u.db.user.fetchUser(newUser.id);
    if (newMember && (!newMember.roles.cache.has(u.sf.roles.moderation.trusted) || user?.watching)) {
      const embed = u.embed({ author: oldUser })
        .setTitle("User Update")
        .setDescription(newUser.toString())
        .setFooter({ text: newUser.id });

      const usernames = [
        oldUser instanceof Discord.User ? oldUser.username : oldUser.displayName,
        newUser instanceof Discord.User ? newUser.username : newUser.displayName
      ];
      if (oldUser.displayName !== newUser.displayName || usernames[0] !== usernames[1]) {
        /** @param {string} a @param {string} b */
        const same = (a, b) => u.escapeText(a === b ? a : `${a} (${b})`);

        embed.addFields(
          { name: "Old Username", value: same(usernames[0], oldUser.displayName) },
          { name: "New Username", value: same(usernames[1], newUser.displayName) }
        );
      }
      if (oldUser.avatar !== newUser.avatar) {
        embed.addFields({ name: "Avatar Update", value: "See Below" }).setImage(newUser.displayAvatarURL({ extension: "png" }));
      } else {
        embed.setThumbnail(newUser.displayAvatarURL());
      }
      if ((embed.data.fields?.length || 0) > 0) {
        embed.addFields({ name: "Activity", value: `${user?.posts ?? 0} active minutes in ${u.moment(newMember?.joinedTimestamp).fromNow(true)}` });
        ldsg?.client.getTextChannel(u.sf.channels.mods.userUpdates)?.send({ content: `${newUser} (${newUser.displayName})`, embeds: [embed], components: [
          u.MessageActionRow().addComponents(new u.Button().setCustomId("timeModInfo").setEmoji("👤").setLabel("User Info").setStyle(Discord.ButtonStyle.Secondary))
        ] });
      }
    }
  } catch (error) { u.errorHandler(error, `User Update Error: ${u.escapeText(newUser?.displayName)} (${newUser.id})`); }
}

const Module = new Augur.Module()
.addEvent("channelCreate", (channel) => {
  try {
    if (channel.guild?.id === u.sf.ldsg) {
      if (channel.permissionsFor(channel.client.user)?.has(["ViewChannel", "ManageChannels"])) {
        // muted role
        channel.permissionOverwrites.create(u.sf.roles.moderation.muted, mutedPerms, { reason: "New channel permissions update" })
        .catch(/** @param {Error} e */e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
        // duct tape role
        channel.permissionOverwrites.create(u.sf.roles.moderation.ductTape, mutedPerms, { reason: "New channel permissions update" })
          .catch(/** @param {Error} e */e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
      } else {
        channel.client.getTextChannel(u.sf.channels.team.logistics)?.send({ embeds: [
          u.embed({
            title: "Update New Channel Permissions",
            description: `Insufficient permissions to update channel ${channel} (#${channel.name}). Muted permissions need to be applied manually. Default denied permissions for Muted and Duct Tape are:\n\`\`\`${Object.keys(mutedPerms).join('\n')}\`\`\``,
            color: c.colors.info
          })
        ] });
      }
    }
  } catch (error) {
    u.errorHandler(error, "Set permissions on channel create");
  }
})
.addEvent("guildBanAdd", (guildBan) => {
  const guild = guildBan.guild;
  const user = guildBan.user;
  if (guild.id === u.sf.ldsg) {
    guild.client.getTextChannel(u.sf.channels.mods.logs)?.send({
      embeds: [
        u.embed({
          author: user,
          title: `${user.username} has been banned`,
          color: c.colors.info,
          description: user.toString(),
          footer: { text: user.id }
        })
      ],
      components: [
        u.MessageActionRow().addComponents(new u.Button().setCustomId("timeModInfo").setEmoji("👤").setLabel("User Info").setStyle(Discord.ButtonStyle.Secondary))
      ]
    });
  }
})
.addEvent("guildMemberAdd", async (member) => {
  try {
    if (member.guild.id === u.sf.ldsg) {
      const guild = member.guild;

      const user = await u.db.user.fetchUser(member.id, false);
      const general = guild.client.getTextChannel(u.sf.channels.general);
      const welcomeChannel = guild.client.getTextChannel(u.sf.channels.welcome);
      const modLogs = guild.client.getTextChannel(u.sf.channels.mods.logs);

      const embed = u.embed({ author: member })
        .setColor(c.colors.info)
        .addFields(
          { name: "User", value: member.toString(), inline: true },
          { name: "Account Created", value: member.user.createdAt.toLocaleDateString(), inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ extension: "png" }))
        .setFooter({ text: member.id });

      /** @type {string} */
      let welcomeString;

      // Member is returning
      if (user) {
        /** @type {Discord.Role[][]} */
        const [toAdd, danger, failed] = [[], [], []];

        for (const roleId of user.roles) {
          // ensure role still exists
          const role = guild.roles.cache.get(roleId);
          if (!role) continue;

          // can't be applied
          if (role.managed || role.position >= (guild.members.me?.roles.highest.position ?? 0)) {
            failed.push(role);
          } else if (dangerRoles.includes(roleId)) { // dangerous!
            danger.push(role);
          } else { // go ahead and add!
            toAdd.push(role);
          }
        }

        if (toAdd.length > 0) {
          await member.roles.add(toAdd).catch(() => {
            u.errorHandler(new Error("Rejoin Roles Apply Failed"), "Check the console to find their lost roles");
            // eslint-disable-next-line no-console
            console.log("failed", failed.map(f => f.id).join("\n"));
            // eslint-disable-next-line no-console
            console.log("toAdd", toAdd.map(f => f.id).join("\n"));
          });
        }

        const addSurplus = toAdd.length - 30;
        const failedSurplus = failed.length - 30;
        const dangerSurplus = danger.length - 30;
        let roleString = toAdd.sort((a, b) => b.comparePositionTo(a)).map(role => role.toString()).slice(0, 30).join(", ");
        if (addSurplus > 0) roleString += ` + ${addSurplus} more`;
        embed.addFields({ name: "Roles Given", value: roleString || "None" });

        if (failed.length > 0) embed.addFields({ name: "\n⚠️ FAILED TO GIVE THESE ROLES", value: failed.slice(0, 30).join(", ") + (failedSurplus > 0 ? ` + ${failedSurplus}` : "") });
        if (danger.length > 0) embed.addFields({ name: "\n⛔ Dangerous Roles Not Given: ", value: danger.slice(0, 30).join(", ") + (dangerSurplus > 0 ? ` + ${dangerSurplus}` : "") });

        embed.setTitle(member.displayName + " has rejoined the server.")
          .addFields(
            { name: "Chat Activity", value: `${user.posts} Active Minutes` },
            { name: "Voice Activity", value: `${user.voice} Active Minutes` }
          );
        welcomeString = `Welcome back, ${member}! Glad to see you again.`;

      } else { // Member is new
        const welcome = u.rand([
          "Welcome",
          "Hi there",
          "Glad to have you here",
          "Ahoy"
        ]);
        const info1 = u.rand([
          "Take a look at",
          "Check out",
          "Head on over to"
        ]);
        const info2 = u.rand([
          "to get started",
          "for some basic community rules",
          "and join in the chat"
        ]);
        const info3 = u.rand([
          "What brings you our way?",
          "How'd you find us?",
          "What platforms/games do you play?"
        ]);
        welcomeString = `${welcome}, ${member}! ${info1} ${welcomeChannel} ${info2}. ${info3}\n\nTry \`!profile\` over in <#${u.sf.channels.botSpam}> if you'd like to opt in to roles or share IGNs.`;
        embed.setTitle(member.displayName + " has joined the server.");

        u.db.user.newUser(member.id);
      }
      modLogs?.send({ embeds: [embed], components: [
        u.MessageActionRow().addComponents(new u.Button().setCustomId("timeModInfo").setEmoji("👤").setLabel("User Info").setStyle(Discord.ButtonStyle.Secondary))
      ] });

      const { enabled, count } = config.memberMilestone;
      if (enabled && (guild.memberCount < count)) welcomeString += `\n*${count - guild.memberCount} more members until we have a pizza party!*`;
      if (!member.roles.cache.has(u.sf.roles.moderation.muted) && !member.user.bot && !banned.includes(member.id)) await general?.send({ content: welcomeString, allowedMentions: { parse: ['users'] } });
      if (guild.memberCount === count) {
        await general?.send(`:tada: :confetti_ball: We're now at ${count} members! :confetti_ball: :tada:`);
        await modLogs?.send({ content: `:tada: :confetti_ball: We're now at ${count} members! :confetti_ball: :tada:\n*pinging for effect: <@${u.sf.other.ghost}> <@${config.ownerId}> <@&${u.sf.roles.team.management}*`, allowedMentions: { parse: ['roles', 'users'] } });
      }
    }
  } catch (e) { u.errorHandler(e, "New Member Add"); }
})
.addEvent("guildMemberRemove", async (member) => {
  try {
    if (member.guild.id === u.sf.ldsg) {
      if (member.partial) member = await member.fetch().catch(() => member);
      if (member.partial) return; // failed to fetch
      await u.db.user.updateTenure(member);
      await u.db.user.updateRoles(member);
      const user = await u.db.user.fetchUser(member.id);
      const embed = u.embed({
        author: member,
        title: `${member.displayName} has left the server`,
        color: c.colors.info,
        footer: { text: member.id }
      })
      .addFields(
        { name: "User", value: member.toString() },
        { name: "Joined", value: u.moment(member.joinedAt).fromNow(), inline: true },
        { name: "Activity", value: (user?.posts || 0) + " Active Minutes", inline: true }
      );
      member.guild.client.getTextChannel(u.sf.channels.mods.logs)?.send({ embeds: [embed], components: [
        u.MessageActionRow().addComponents(new u.Button().setCustomId("timeModInfo").setEmoji("👤").setLabel("User Info").setStyle(Discord.ButtonStyle.Secondary))
      ] });
    }
  } catch (error) { u.errorHandler(error, `Member Leave: ${u.escapeText(member.displayName)} (${member.id})`); }
})
.addEvent("guildMemberUpdate", update)
.addEvent("userUpdate", update)
.setClockwork(() => {
  return setInterval(() => {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg?.premiumSubscriptionCount) return;
    if (ldsg.premiumSubscriptionCount < tier3) {
      if (!lowBoosts) Module.client.getTextChannel(u.sf.channels.team.team)?.send(`# ⚠️ We've dropped to ${ldsg.premiumSubscriptionCount} boosts!\n${tier3} boosts are required for Tier 3.`);
      lowBoosts = true;
    } else {
      lowBoosts = false;
    }
  }, 60 * 60_000);
});


module.exports = Module;
