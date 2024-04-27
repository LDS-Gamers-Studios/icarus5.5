// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  moment = require("moment"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  config = require('../config/config.json');

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
/**
 * @typedef Sponsor
 * @prop {string} Sponsor The sponsor's ID
 * @prop {string} Channel The sponsor's channel ID
 * @prop {string} Emoji The sponsor's reaction emoji ID
 */
// roles that SHOULD NOT be given when a user rejoins
const dangerRoles = [
  u.sf.roles.team, u.sf.roles.management, u.sf.roles.manager, u.sf.roles.mod,
  u.sf.roles.live, u.sf.roles.headofhouse, u.sf.roles.emberguardian,
  u.sf.roles.destinyclansmanager, u.sf.roles.volunteer
];

let emojis = [];
const Module = new Augur.Module()
.addEvent("channelCreate", (channel) => {
  try {
    if (channel.guild?.id == u.sf.ldsg) {
      if (channel.permissionsFor(channel.client.user)?.has(["ViewChannel", "ManageChannels"])) {
        // muted role
        channel.permissionOverwrites.create(u.sf.roles.muted, mutedPerms, { reason: "New channel permissions update" })
        .catch(e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
        // duct tape role
        channel.permissionOverwrites.create(u.sf.roles.ducttape, mutedPerms, { reason: "New channel permissions update" })
          .catch(e => u.errorHandler(e, `Update New Channel Permissions: ${channel.name}`));
      } else {
        u.errorLog.send({ embeds: [
          u.embed({
            title: "Update New Channel Permissions",
            description: `Insufficient permissions to update channel ${channel.name}. Muted permissions need to be applied manually. Default permissions for Muted and Duct Tape are:\n${JSON.stringify(mutedPerms, null, 2).replace(/[{}"]/g, "")}`
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
  if (guild.id == u.sf.ldsg) {
    guild.client.getTextChannel(u.sf.channels.modlogs)?.send({
      embeds: [
        u.embed({
          author: user,
          title: `${user.username} has been banned`,
          color: 0x0000ff,
          description: user.toString()
        })
      ]
    });
  }
})
.addEvent("guildMemberAdd", async (member) => {
  try {
    if (member.guild.id == u.sf.ldsg) {
      const guild = member.guild;

      const user = await u.db.user.fetchUser(member.id, false);
      const general = guild.client.getTextChannel(u.sf.channels.general);
      const welcomeChannel = guild.client.getTextChannel(u.sf.channels.welcome);
      const modLogs = guild.client.getTextChannel(u.sf.channels.modlogs);

      const embed = u.embed()
      .setColor(0x7289da)
      .setDescription("Account Created:\n" + member.user.createdAt.toLocaleDateString())
      .setTimestamp()
      .setThumbnail(member.user.displayAvatarURL({ extension: "png" }));

      let welcomeString;

      if (user) { // Member is returning
        const toAdd = user.roles.filter(role => (
          guild.roles.cache.has(role) &&
          !guild.roles.cache.get(role)?.managed &&
          !dangerRoles.includes(role)
        ));
        const oldDanger = user.roles.filter(role => guild.roles.cache.has(role) && dangerRoles.includes(role))
          .map(r => guild.roles.cache.get(r));
        if (user.roles.length > 0) member = await member.roles.add(toAdd);

        let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.toString()).join(", ") + (oldDanger.length > 0 ? "\nOld roles not given: " + oldDanger.join(", ") : "") ;
        if (roleString.length > 1024) roleString = roleString.substring(0, roleString.indexOf(", ", 1000)) + " ...";

        embed.setTitle(member.displayName + " has rejoined the server.")
          .setDescription(member.toString())
          .addFields({ name: "Roles", value: roleString });
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
        welcomeString = `${welcome}, ${member}! ${info1} ${welcomeChannel} ${info2}. ${info3}\n\nTry \`!profile\` over in <#${u.sf.channels.botspam}> if you'd like to opt in to roles or share IGNs.`;
        embed.setTitle(member.displayName + " has joined the server.");

        u.db.user.newUser(member.id);
      }
      modLogs?.send({ embeds: [embed] });

      const { enabled, count } = config.memberMilestone;

      if (enabled && (guild.memberCount < count)) welcomeString += `\n*${count - guild.memberCount} more members until we have a pizza party!*`;
      if (!member.roles.cache.has(u.sf.roles.muted) && !member.user.bot) await general?.send({ content: welcomeString, allowedMentions: { parse: ['users'] } });
      if (guild.memberCount == count) {
        await general?.send(`:tada: :confetti_ball: We're now at ${count} members! :confetti_ball: :tada:`);
        await modLogs?.send(`:tada: :confetti_ball: We're now at ${count} members! :confetti_ball: :tada:\n*pinging for effect: ${guild.members.cache.get(u.sf.other.ghost)} ${guild.members.cache.get(config.ownerId)}*`);
      }
    }
  } catch (e) { u.errorHandler(e, "New Member Add"); }
})
.addEvent("guildMemberRemove", async (member) => {
  try {
    if (member.guild.id == u.sf.ldsg) {
      if (member.partial) member = await member.fetch();
      await u.db.user.updateTenure(member);
      await u.db.user.updateRoles(member);
      const user = await u.db.user.fetchUser(member.id);
      const embed = u.embed({
        author: member,
        title: `${member.displayName} has left the server`,
        description: member.toString(),
        color: 0x5865f2,
      })
      .addFields(
        { name: "Joined", value: moment(member.joinedAt).fromNow(), inline: true },
        { name: "Activity", value: (user?.posts || 0) + " Active Minutes", inline: true }
      );
      member.guild.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
    }
  } catch (error) { u.errorHandler(error, `Member Leave: ${u.escapeText(member.displayName)} (${member.id})`); }
})
.addEvent("userUpdate", async (oldUser, newUser) => {
  try {
    const ldsg = newUser.client.guilds.cache.get(u.sf.ldsg);
    const newMember = ldsg?.members.cache.get(newUser.id);
    if (oldUser.partial) oldUser = await oldUser.fetch();
    const user = await u.db.user.fetchUser(newUser.id).catch(u.noop);
    if (newMember && (!newMember.roles.cache.has(u.sf.roles.trusted) || user?.watching)) {
      const embed = u.embed({ author: oldUser })
        .setTitle("User Update")
        .setDescription(newUser.toString())
        .setFooter({ text: `${user?.posts ?? 0} active minutes ${moment(newMember?.joinedTimestamp).fromNow(true)}` });
      if (oldUser.displayName !== newUser.displayName || oldUser.username !== newUser.username) {
        embed.addFields({ name: "**Username Update**", value: `**Old:** ${u.escapeText(`${oldUser?.username} (displaying as ${oldUser?.displayName})`)}\n**New:** ${u.escapeText(`${newUser.username} (displaying as ${newUser.displayName})`)}` });
      }
      if (oldUser.avatar !== newUser.avatar) {
        embed.addFields({ name: "**Avatar Update**", value: "See Below" }).setImage(newUser.displayAvatarURL({ extension: "png" }));
      } else {
        embed.setThumbnail(newUser.displayAvatarURL());
      }
      ldsg?.client.getTextChannel(u.sf.channels.userupdates)?.send({ content: `${newUser}: ${newUser.id}`, embeds: [embed] });
    }
  } catch (error) { u.errorHandler(error, `User Update Error: ${u.escapeText(newUser?.username)} (${newUser.id})`); }
})
.addEvent("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const ldsg = newMember.client.guilds.cache.get(u.sf.ldsg);
    if (oldMember.partial) oldMember = await oldMember.fetch();
    if (newMember.partial) newMember = await newMember.fetch();
    if (oldMember.guild.id != u.sf.ldsg) return;
    if (newMember && (!newMember.roles.cache.has(u.sf.roles.trusted) || newMember.roles.cache.has(u.sf.roles.untrusted))) {
      const user = await u.db.user.fetchUser(newMember.id, true).catch(u.noop);
      const embed = u.embed({ author: oldMember })
        .setTitle("User Update")
        .setDescription(newMember.toString())
        .setFooter({ text: `${user?.posts ?? 0} Posts in ${moment(newMember?.joinedTimestamp).fromNow(true)}` });
      if (oldMember.nickname !== newMember.nickname) {
        embed.addFields({ name: "**Nickname Update**", value: `**Old:** ${u.escapeText(oldMember?.nickname ?? "")}\n**New:** ${u.escapeText(newMember.nickname ?? "")}` });
      }
      if (oldMember.avatar !== newMember.avatar) {
        embed.addFields({ name: "**Server Avatar Update**", value: "See Below" }).setImage(newMember.displayAvatarURL({ extension: "png" }));
      } else {
        embed.setThumbnail(newMember.displayAvatarURL());
      }
      if ((embed.data.fields?.length || 0) > 0) ldsg?.client.getTextChannel(u.sf.channels.userupdates)?.send({ content: `${newMember}: ${newMember.id}`, embeds: [embed] });
    }
  } catch (error) { u.errorHandler(error, `User Update Error: ${u.escapeText(newMember?.user.username)} (${newMember.id})`); }
})
.setInit(async () => {
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    /** @type {Sponsor[]} */
    // @ts-ignore
    const channels = await doc.sheetsByTitle["Sponsor Channels"].getRows();
    emojis = Array.from(channels.map(x => [x.Sponsor, x.Emoji]))
      .concat([
        ["buttermelon", u.sf.emoji.buttermelon],
        ["noice", u.sf.emoji.noice],
        ["carp", "🐟"]
      ]);
  } catch (e) { u.errorHandler(e, "Load Sponsor Reactions"); }
})
.addEvent("messageCreate", async (msg) => {
  if (!msg.author.bot && msg.guild?.id == u.sf.ldsg) {
    for (const [sponsor, emoji] of emojis) {
      if (msg.mentions.members?.has(sponsor)) await msg.react(emoji).catch(u.noop);
      // Filter out sponsors and test for trigger words
      else if (!msg.guild.members.cache.has(sponsor) && isNaN(sponsor) && Math.random() < 0.3 && msg.content.toLowerCase().includes(sponsor)) await msg.react(emoji).catch(u.noop);
    }
  }
});


module.exports = Module;
