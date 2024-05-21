// @ts-check
const Augur = require("augurbot-ts"),
  config = require("../config/config.json"),
  u = require("../utils/utils");


const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashHelp,
  process: async (int) => {
    await int.deferReply({ ephemeral: true });
    const tags = await u.db.tags.fetchAllTags();
    const embeds = [];
    const ldsg = int.client.guilds.cache.get(u.sf.ldsg);
    const embed = u.embed({ author: int.client.user })
      .setTitle(`Custom Tags in ${ldsg?.name ?? "LDS Gamers"}`)
      .setURL("https://my.ldsgamers.com/commands")
      .setThumbnail(ldsg?.iconURL() ?? null);
    let modifiableEmbed = embed;
    for (const tag of tags) {
      if ((embed.data.description?.length ?? 0) + tag.tag.length + 4 > 4090) {
        embeds.push(modifiableEmbed);
        modifiableEmbed = embed.setTitle(embed.data.title + " (cont.)");
      }
      modifiableEmbed.setDescription((modifiableEmbed.data.description ?? "") + `${config.prefix}${u.escapeText(tag.tag)}\n`);
    }
    if (embeds.length == 0) return int.editReply({ embeds: [modifiableEmbed] });
    const first = embeds.shift();
    await int.editReply({ embeds: first ? [first] : [] });
    Promise.all(embeds.map(e => {
      int.followUp({ embeds: [e], ephemeral: true });
    }));
  }
});

module.exports = Module;