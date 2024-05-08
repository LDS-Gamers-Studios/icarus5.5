// @ts-check
const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  banners = require('../data/banners.json'),
  fs = require('fs'),
  path = require('path'),
  cake = require('./cake');

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCakeday(int) {
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const date = new Date(`${month} ${day} ${new Date().getFullYear()}`);
  date.setHours(10);
  if (isNaN(date.valueOf())) return int.editReply("I'm not sure how, but that date didn't work...");
  // @ts-expect-error we're doing janky stuff here :)
  cake.unload(date, "cake");
  return int.editReply("Cakeday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runBirthday(int) {
  const month = int.options.getString("month", true);
  const day = int.options.getInteger("day", true);
  const date = new Date(`${month} ${day} ${new Date().getFullYear()}`);
  date.setHours(10);
  if (isNaN(date.valueOf())) return int.editReply("I'm not sure how, but that date didn't work...");
  // @ts-expect-error we're doing janky stuff here :)
  cake.unload(date, "bday");
  return int.editReply("Birthday run!");
}


/** @param {string} [holiday] */
async function setBanner(holiday) {
  const date = new Date();
  const month = date.getMonth();
  const day = date.getDate();

  // should look for the banners in banners.json
  const banner = banners.find(b => holiday ? b.file == holiday.toLowerCase() : b.month === month && b.day === day);
  if (!banner) return "I couldn't find that file."; // end function here if there's not a banner

  const bannerPath = `media/banners/${banner.file}.png`;

  const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) {
    u.errorHandler(new Error("LDSG is unavailable. (Banner Set)"));
    return null;
  }

  // notify management if setting fails
  try {
    await ldsg.setBanner(bannerPath);
  } catch (error) {
    if (holiday) return "I couldn't set the banner.";
    Module.client.getTextChannel(u.sf.channels.management)?.send({
      content: `Failed to set banner, please do this manually.`,
      files: [bannerPath]
    });
  }

  return "I set the banner!";
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function role(int) {
  try {
    await int.deferReply({ ephemeral: true });
    const input = int.options.getString("role", true);
    const member = int.options.getMember("user");
    const reason = int.options.getString("reason") ? "\nReason: ".concat(int.options.getString("reason") ?? "") : "";
    const ro = int.guild.roles.cache.find(r => r.name.toLowerCase() == input.toLowerCase());
    if (ro) {
      if (![u.sf.roles.logistics, u.sf.roles.publicaffairs, u.sf.roles.operations, u.sf.roles.manager, u.sf.roles.mod].includes(ro.id)) return int.editReply(`Sorry, ${ro} is not a valid promotion role`);
      if (member?.roles.cache.has(ro.id)) return int.editReply(`${member.user.username} already has the ${ro} role`);
      if ([u.sf.roles.manager, u.sf.roles.mod].includes(ro.id)) {
        member?.roles.add([u.sf.roles.publicaffairs, ro.id, u.sf.roles.team, u.sf.roles.thenextchapter]);
        const embed = u.embed({ author: member, color: 0x00ffff });
        embed.setTitle(`User added to ${ro}`)
            .setDescription(`${int.member} added ${member} to ${ro}${reason}`);
        int.client.getTextChannel(u.sf.channels.modlogs)?.send({ embeds: [embed] });
        return int.editReply(`Successfully promoted ${member} to ${ro}`);
      } else {
        member?.roles.add([u.sf.roles.team, u.sf.roles.thenextchapter, ro.id]);
        const embed = u.embed({ author: member, color: 0x00ffff });
        embed.setTitle(`User added to ${ro}`)
          .setDescription(`${int.member} added ${member} to ${ro}${reason}`);
        int.client.getTextChannel(u.sf.channels.team)?.send({ embeds: [embed] });
        return int.editReply(`Successfully promoted ${member} to ${ro}`);
      }
    } else { return int.editReply(`I couldn't find that role`); }
  } catch (error) { u.errorHandler(error, int); }
}

const Module = new Augur.Module()
.addInteraction({
  name: "management",
  id: u.sf.commands.slashManagement,
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ ephemeral: true });
    switch (subcommand) {
    case "cakeday": return runCakeday(int);
    case "birthday": return runBirthday(int);
    case "banner": {
      int.editReply("Setting banner...");
      const response = await setBanner(int.options.getString("file", true));
      if (response) int.editReply(response);
    } break;
    case "team": return role(int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused(true);
    if (option.name == 'position') {
      const values = ["Discord Manager", "Discord Moderator", "Logistics Team", "Public Affairs Team", "Ops Team"];
      return int.respond(values.map(v => ({ name: v, value: v })));
    }
    const files = fs.readdirSync(path.resolve(__dirname + "/../media/banners"))
      .filter(file => file.endsWith(".png") && file.startsWith(option.name))
      .map(f => f.substring(0, f.length - 4));
    int.respond(files.slice(0, 24).map(f => ({ name: f, value: f })));
  }
})
.setClockwork(() =>
  setInterval(() => setBanner(), 1000 * 60 * 60 * 24)
);

module.exports = Module;