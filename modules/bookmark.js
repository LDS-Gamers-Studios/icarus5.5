// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils");

// Message context menu for bookmarking a message.

const Module = new Augur.Module()
.addInteraction({
  name: "Bookmark",
  id: u.sf.commands.messageBookmark,
  type: "ContextMessage",
  process: async (interaction) => {
    try {
      await interaction.deferReply({ flags: ["Ephemeral"] });
      const message = await interaction.channel?.messages.fetch(interaction.targetId).catch(u.noop);
      if (message) {
        await interaction.editReply("I'm sending you a DM!");
        const embed = u.embed({ author: message.member ?? message.author })
          .setDescription(message.cleanContent || null)
          .setColor(message.member?.displayColor ?? null)
          .setTimestamp(message.createdAt)
          .addFields({ name: "Jump to Post", value: `[Original Message](${message.url})` });
        return interaction.user.send({ embeds: [embed, ...message.embeds], files: Array.from(message.attachments.values()) }).catch(() => {
          interaction.editReply("I wasn't able to send the message! Do you have DMs from server members turned off?");
        });
      }
      interaction.editReply("Against all odds, I couldn't find that message.");

    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
});

module.exports = Module;
