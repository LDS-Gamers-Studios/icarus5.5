// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  Discord = require("discord.js");

/** Responds with the number of guild members, and how many are online.
 *
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 */
async function slashLdsgMembers(interaction) {
  try {
    // @ts-ignore - this function can only be run in a guild.
    const online = interaction.guild.members.cache.filter((member) => member?.presence?.status != "offline" && member.presence?.status != undefined);
    // @ts-ignore - this function can only be run in a guild.
    const response = `📈 **Members:**\n${interaction.guild.memberCount} Members\n${online.size} Online`;
    await interaction.reply({ content: response });
  } catch (error) { u.errorHandler(error, interaction); }
}

/** The LDSG Member Spotlight!
 *
 * It's in a reduced functionality mode since it's complicated to migrate, and it's currently not in use.
 *
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that the user submits.
 */
async function slashLdsgSpotlight(interaction) {
  try {
    await interaction.reply({ content: "[Take a look!](https://www.ldsgamers.com/community#member-spotlight)" });
  } catch (error) { u.errorHandler(error, interaction); }
}

const Module = new Augur.Module()
  .addInteraction({
    name: "ldsg",
    id: u.sf.commands.slashLdsg,
    process: async (interaction) => {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
      case "members": await slashLdsgMembers(interaction); break;
      case "spotlight": await slashLdsgSpotlight(interaction); break;
      }
    }
  });

module.exports = Module;
