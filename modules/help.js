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
    const ldsg = int.client.guilds.cache.get(u.sf.ldsg);
    const embed = u.embed({ author: int.client.user })
      .setTitle(`Custom Tags in ${ldsg?.name ?? "LDS Gamers"}`)
      .setURL("https://my.ldsgamers.com/commands")
      .setThumbnail(ldsg?.iconURL() ?? null);
    const mapped = tags.map(t => `${config.prefix}${u.escapeText(t.tag)}`);
    u.pagedEmbeds(int, embed, mapped, true);
  }
});

module.exports = Module;