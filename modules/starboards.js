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
      banned.channels.hasAny(msg.channelId, msg.channel.parentId || "") || // not a banned channel
      !react || banned.emoji.has(react) // not a banned emoji
    ) return;

    const boards = u.db.sheets.starboards.boards;

    const board = boards.find(b => b.priorityChannels.has(msg.channelId) || b.priorityChannels.has(msg.channel.parentId || "")) ||
      boards.find(b => b.priorityEmoji.has(react)) ||
      boards.find(b => b.priorityEmoji.has("ALL"));

    if (!board || board.threshold !== reaction.count) return;
    if (await u.db.starboard.getMessage(msg.id)) return;

    const embeds = [];
    const embed = u.msgReplicaEmbed(msg, "", true, true)
      .setColor(0xf0de76);
    if (reaction.emoji.name) embed.setFooter({ text: reaction.emoji.name });
    embeds.push(embed);

    const ref = await reaction.message.fetchReference().catch(u.noop);
    if (ref) {
      const refEmbed = u.msgReplicaEmbed(ref, `Replying to ${ref.member?.displayName || ref.author.displayName}`, false, true)
        .setColor(0x202020);
      embeds.unshift(refEmbed);
    }

    await u.db.starboard.saveMessage(msg.id, msg.createdTimestamp);

    if (!board.approval) {
      await board.channel.send({ embeds });
      return;
    }

    // add to the approval queue
    embed.addFields({ name: "Destination", value: `${board.channel} | ${board.channel.id}` });
    const row = u.MessageActionRow().addComponents(
      new u.Button().setCustomId("starboardApprove").setLabel("Approve").setStyle(Discord.ButtonStyle.Success),
      new u.Button().setCustomId("starboardReject").setLabel("Reject").setStyle(Discord.ButtonStyle.Danger)
    );
    reaction.client.getTextChannel(u.sf.channels.starboardApprovals)?.send({ embeds, components: [row] });
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
      const embed1 = int.message.embeds?.[0];
      const embed2 = int.message.embeds?.[1];

      const modifyingEmbed = embed2 ?? embed1;
      // there was a reply embed

      const channelId = modifyingEmbed?.fields?.find(f => f.name === "Destination")?.value.split(" | ")[1];
      const channel = int.client.getTextChannel(channelId || "");

      if (!modifyingEmbed || !channel) return int.editReply("Sorry, I couldn't repost this message.");

      const richEmbed = u.embed(modifyingEmbed)
        .setFields(modifyingEmbed.fields.filter(f => f.name !== "Destination"));

      /** @type {(Discord.Embed | Discord.EmbedBuilder)[]} */
      const embeds = [richEmbed];
      if (embed2 && embed1) embeds.unshift(embed1);

      await int.editReply({ components: [], content: "Approved" });
      channel.send({ embeds });
    }
  })
  .addInteraction({
    id: "starboardReject",
    type: "Button",
    onlyGuild: true,
    permissions: (int) => u.perms.calc(int.member, ["team"]),
    process: async (int) => {
      const embed1 = int.message.embeds?.[0];
      const embed2 = int.message.embeds?.[1];

      const modifyingEmbed = embed2 ?? embed1;
      if (modifyingEmbed) {

        const richEmbed = u.embed(modifyingEmbed).setColor(0xff0000);
        /** @type {(Discord.Embed | Discord.EmbedBuilder)[]} */
        const embeds = [richEmbed];
        if (embed2 && embed1) embeds.unshift(embed1);

        return int.update({ components: [], content: "Denied", embeds });
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