// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js");

/**
 * Responds with the number of guild members, and how many are online.
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 */
async function slashLdsgMembers(interaction) {
  try {
    const ldsg = interaction.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("Couldn't find LDSG");
    const online = ldsg.members.cache.filter((member) => member?.presence && member.presence.status != "offline");
    const response = `📈 **Members:**\n${ldsg.memberCount} Members\n${online.size} Online`;
    await interaction.reply({ content: response });
  } catch (error) { u.errorHandler(error, interaction); }
}

const Module = new Augur.Module()
  .addInteraction({
    name: "ldsg",
    id: u.sf.commands.slashLdsg,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
        case "members": return slashLdsgMembers(interaction);
      }
    }
  });

module.exports = Module;
