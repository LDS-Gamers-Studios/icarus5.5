// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  banners = require('../data/banners.json'),
  fs = require('fs'),
  path = require('path'),
  Module = new Augur.Module();

/**
 * @param {Discord.Client} client
 * @returns {import("./cake").Shared}
 */
function cakeFunctions(client) {
  return client.moduleManager.shared.get("cake.js");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCakeday(int) {
  const dateInput = int.options.getString("date");
  if (dateInput) {
    const date = new Date(dateInput);
    date.setHours(10);
    if (isNaN(date.valueOf())) return int.editReply("Sorry, but I couldn't understand that date.");
    cakeFunctions(int.client)?.cakedays(date);
  } else {
    cakeFunctions(int.client)?.cakedays();
  }
  return int.editReply("Cakeday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runBirthday(int) {
  const dateInput = int.options.getString("date");
  const user = int.options.getMember("user") ?? int.options.getUser("user");
  if (user) {
    if (!int.guild.members.cache.has(user.id)) return int.editReply("That person isn't in the server!");
    cakeFunctions(int.client)?.birthdays(undefined, [{ discordId: user.id, ign: u.moment().format("MMM D YYYY-HH") }]);
  } else if (dateInput) {
    const date = new Date(dateInput);
    date.setHours(10);
    if (isNaN(date.valueOf())) return int.editReply("Sorry, but I couldn't understand that date.");
    cakeFunctions(int.client)?.birthdays(date);
  } else {
    cakeFunctions(int.client)?.birthdays();
  }
  return int.editReply("Birthday run!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
function runCelebrate(int) {
  cakeFunctions(int.client)?.celebrate(true);
  return int.editReply("Celebrate run!");
}

/** @param {string} [holiday] */
async function setBanner(holiday) {
  const date = new Date();
  const month = date.getMonth();
  const day = date.getDate();

  // should look for the banners in banners.json
  const banner = banners.find(b => holiday ? b.file === holiday.toLowerCase() : b.month === month && b.day === day);
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
    Module.client.getTextChannel(u.sf.channels.team.logistics)?.send({
      content: `Failed to set banner, please do this manually.`,
      files: [bannerPath]
    });
  }

  return "I set the banner!";
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashChannelActivity(int) {
  try {
    await int.deferReply({ flags: ["Ephemeral"] });
    const last = Date.now() - (14 * 24 * 60 * 60 * 60_000); // 14 days ago

    // makes sure that the bot can see the channel and that it isn't archive and that it is a text channel
    const channels = int.guild.channels.cache.filter(ch => (ch.isTextBased() && ch.permissionsFor(int.client.user)?.has("ViewChannel") && (ch.parentId !== u.sf.channels.archiveCategory)));
    const fetch = channels.map(ch => {
      if (ch.isTextBased()) {
        return ch.messages.fetch({ limit: 100 });
      }
    });

    // fetch da messages
    const channelMsgs = await Promise.all(fetch);
    const stats = new u.Collection(channels.map(ch => ([ch.id, { channel: ch, messages: 0 } ])));

    // Goes through the channels and updates the the message count for each
    for (let messages of channelMsgs) {
      if (!messages) continue;
      messages = messages.filter(m => m.createdTimestamp > last); // get messages within 14 days

      if ((messages?.size ?? 0) > 0) { // makes sure that messages were sent
        const channel = messages.first()?.channel;
        if (!channel) continue;

        // update the message count
        stats.ensure(channel.id ?? "", () => ({ channel, messages: 0 })).messages = messages.size;
      }
    }

    const categories = int.guild.channels.cache.filter(ch => ch.type === Discord.ChannelType.GuildCategory).sort((a, b) => {
      if (!a.isThread() && !b.isThread()) {
        return a.position - b.position;
      }
      return 0;
    });

    /** @type {string[]} */
    const lines = [];

    for (const [categoryId, category] of categories) {
      // sorts from most to least active and removes all active channels
      const categoryStats = stats.filter(ch => ch.channel.parentId === categoryId && ch.messages < 25).sort((a, b) => {
        if (!a.channel.isThread() && !b.channel.isThread()) {
          return a.channel.position - b.channel.position;
        }
        return 0;
      });

      if (categoryStats.size > 0) {
        lines.push(`**${category.name}**\n${categoryStats.map(ch => `<#${ch.channel.id}>: ${ch.messages}`).join("\n")}\n\n`);
      }
    }

    const embed = u.embed().setTitle("Channel Activity");
    const processedEmbeds = u.pagedEmbedsDescription(embed, lines).map(e => ({ embeds: [e] }));
    return u.manyReplies(int, processedEmbeds, true);
  } catch (error) {
    u.errorHandler(error, int);
  }
}

Module.addInteraction({
  name: "management",
  id: u.sf.commands.slashManagement,
  onlyGuild: true,
  options: { registry: "slashManagement" },
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ flags: ["Ephemeral"] });
    switch (subcommand) {
      case "celebrate": return runCelebrate(int);
      case "cakeday": return runCakeday(int);
      case "birthday": return runBirthday(int);
      case "banner": {
        const response = await setBanner(int.options.getString("file", true));
        if (response) int.editReply(response);
        break;
      }
      case "channel-activity": return slashChannelActivity(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused();
    const files = fs.readdirSync(path.resolve(__dirname + "/../media/banners"))
      .filter(file => file.endsWith(".png") && file.includes(option))
      .map(f => f.substring(0, f.length - 4));
    int.respond(files.slice(0, 24).map(f => ({ name: f, value: f })));
  }
})
.setClockwork(() =>
  setInterval(() => setBanner(), 24 * 60 * 60_000)
);

module.exports = Module;
