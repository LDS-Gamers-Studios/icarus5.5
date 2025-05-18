const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");


/**
 * @param {Augur.NonPartialMessageReaction} reaction
 * @param {Discord.User} user
 */
async function checkStarBoard(reaction, user) {
  try {
    if (reaction.partial) await reaction.fetch().catch(u.noop);
    if (reaction.message.partial) await reaction.message.fetch().catch(u.noop);

    const react = reaction.emoji.id || reaction.emoji.name;
    const msg = reaction.message;
    const banned = u.db.sheets.starboards.banned;

    if (
      user.bot || msg.author.bot || msg.author.system || // no bots
      msg.guildId !== u.sf.ldsg || !msg.inGuild() || // in the server
      msg.createdTimestamp < Date.now() - 7 * 24 * 60 * 60_000 || // recent posts only
      banned.channels.has(msg.channelId) || banned.channels.has(msg.channel.parentId || "") || // not a banned channel
      !react || banned.emoji.has(react) // not a banned emoji
    ) return;

    const boards = u.db.sheets.starboards.boards;
    const board = boards.find(b => b.priorityChannels.has(msg.channelId) || b.priorityChannels.has(msg.channel.parentId || "")) || boards.find(b => b.priorityEmoji.has(react)) || boards.find(b => b.priorityEmoji.has("ALL"));

    if (!board || board.threshold !== reaction.count) return;
    if (await u.db.starboard.getMessage(msg.id)) return;

    const embed = u.msgReplicaEmbed(msg, "", false, true);
    if (reaction.emoji.name) embed.setFooter({ text: reaction.emoji.name });

    await u.db.starboard.saveMessage(msg.id, msg.createdTimestamp);

    if (!board.approval) return await board.channel.send({ embeds: [embed] });

    // add to the approval queue
    embed.addFields({ name: "Destination", value: `${board.channel} | ${board.channel.id}` });
    const row = u.MessageActionRow().addComponents(
      new u.Button().setCustomId("starboardApprove").setLabel("Approve").setStyle(Discord.ButtonStyle.Success),
      new u.Button().setCustomId("starboardReject").setLabel("Reject").setStyle(Discord.ButtonStyle.Danger)
    );
    reaction.client.getTextChannel(u.sf.channels.starboardApprovals)?.send({ embeds: [embed], components: [row] });
    return;

  } catch (error) {
    u.errorHandler(error, `Starboard - ${reaction.message.id}`);
  }
}

const Module = new Augur.Module()
  .addEvent("messageReactionAdd", checkStarBoard)
  .addInteraction({
    id: "starboardApprove",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["team"]),
    process: async (int) => {
      await int.deferUpdate();

      if (int.message.partial) await int.message.fetch();
      const embed = int.message.embeds?.[0];

      const channelId = embed?.fields?.find(f => f.name === "Destination")?.value.split(" | ")[1];
      const channel = int.client.getTextChannel(channelId || "");

      if (!embed || !channel) return int.editReply("Sorry, I couldn't repost this message.");

      const richEmbed = u.embed(embed)
        .setFields(embed.fields.filter(f => f.name !== "Destination"));

      await int.editReply({ components: [], content: "Approved" });
      channel.send({ embeds: [richEmbed] });
    }
  })
  .addInteraction({
    id: "starboardReject",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["team"]),
    process: async (int) => {
      const embed = int.message.embeds?.[0];
      if (embed) {
        const richEmbed = u.embed(embed).setColor(0xff0000);
        return int.update({ components: [], content: "Denied", embeds: [richEmbed] });
      }
      return int.update({ components: [], content: "Denied" });
    }
  })
  .setClockwork(() => {
    return setInterval(() => {
      u.db.starboard.cleanup();
    }, 24 * 60 * 60_000);
  });

module.exports = Module;