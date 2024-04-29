// @ts-check

const u = require("../utils/utils"),
  p = require('../utils/perms'),
  Augur = require("augurbot-ts"),
  banners = require('../data/banners.json');

function setBanner(holiday) { // !! added an optional parameter to set a banner
  const date = new Date();
  const month = date.getMonth();
  const day = date.getDate();

  // should look for the banners in banners.json
  const banner = banners.find(b => holiday ? b.file == holiday.toLowerCase() : b.month === month && b.day === day);
  if (!banner) return; // !! end function here if there's not a banner

  const bannerPath = `media/banners/${banner.file}`;

  const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) return u.errorHandler(new Error("LDSG is unavailable. (Banner Set)"));

  // !! they only need a notification if it fails
  ldsg.setBanner(bannerPath).catch(() => {
    Module.client.getTextChannel(u.sf.channels.management)?.send({
      content: `Failed to set banner, please do this manually.`,
      files: [bannerPath]
    });
  });
}

const Module = new Augur.Module()
  .setClockwork(() =>
    setInterval(() => setBanner(), 1000 * 60 * 60 * 24)
  )
  .addCommand({ name: "setbanner",
    onlyGuild: true,
    permissions: (m) => Boolean(m.member && p.calc(m.member, [])),
    process: (msg, suffix) => {
      msg.reply("Setting banner...");
      setBanner(suffix);
    }
  });
// :sniffa:
module.exports = Module;