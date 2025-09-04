// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils");

// Message context menu for bookmarking a message.

const Module = new Augur.Module()
.addInteraction({
  name: "Bookmark",
  type: "ContextMessage",
  id: u.sf.commands.messageBookmark,
  process: async (int) => {
    try {
      await int.deferReply({ flags: ["Ephemeral"] });

      const message = await int.channel?.messages.fetch(int.targetId).catch(u.noop);
      if (!message) return int.editReply("Against all odds, I couldn't find that message.");

      await int.editReply("I'm sending you a DM!");

      const embed = u.msgReplicaEmbed(message, "", true, false);

      return int.user.send({ embeds: [embed, ...message.embeds], files: Array.from(message.attachments.values()) }).catch(() => {
        int.editReply("I wasn't able to send the message! Do you have DMs from server members turned off?");
      });


    } catch (error) {
      u.errorHandler(error, int);
    }
  }
});

module.exports = Module;
