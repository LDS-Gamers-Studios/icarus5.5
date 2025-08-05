// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");

/**
 * TODO:
 * Figure out the best way to !uncoolkids yourself
 */

const emojis = [
  ["buttermelon", u.sf.emoji.buttermelon],
  ["noice", u.sf.emoji.noice],
  ["carp", "🐟"]
];

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {boolean} invite
 */
async function slashSponsorInvite(int, invite) {
  const sponsorChannel = u.db.sheets.sponsors.get(int.member.id)?.channel;
  if (!sponsorChannel) return int.reply({ content: "Looks like your sponsor info hasn't been set up! Contact a Discord Manager or Management to get the process started.", flags: ["Ephemeral"] });

  const invitee = int.options.getMember("user");
  if (!invitee) return int.reply({ content: "Sorry, I couldn't find that user!", flags: ["Ephemeral"] });

  if (invitee.id === int.member.id) return int.reply({ content: `You? Of all the people you could ${invite ? "invite" : "remove"}, you chose yourself? I've got some rough news for ya, buddy. No can do.`, flags: ["Ephemeral"] });

  // Check to see if the permissions are already set
  const alreadyIn = sponsorChannel.permissionsFor(invitee).has("ViewChannel");
  if (alreadyIn === invite) {
    if (invite) {
      return int.reply({ content: `${invitee} is already in your channel!`, flags: ["Ephemeral"] });
    }
    return int.reply({ content: `${invitee} isn't in your channel!`, flags: ["Ephemeral"] });
  }

  await int.deferReply({ flags: ["Ephemeral"] });

  // Case for adding someone to the channel
  if (invite) {
    await sponsorChannel.permissionOverwrites.create(invitee, { ViewChannel: true }, { reason: "Pro Sponsor Invite" });
    await int.editReply(`${invitee} is now in ${sponsorChannel}!`);
    return sponsorChannel.send({ content: `Hey ${invitee}! Welcome to ${int.member}'s pro sponsor channel!`, allowedMentions: { users: [invitee.id] } });
  }

  // Case for removing someone form the channel
  await sponsorChannel.permissionOverwrites.delete(invitee, "Pro Sponsor Uninvite");
  return int.editReply(`${invitee} has been shown the door.`);
}


const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashSponsor,
  onlyGuild: true,
  permissions: (int) => int.member?.roles.cache.hasAny(u.sf.roles.sponsors.pro, u.sf.roles.sponsors.legendary),
  process: (int) => {
    try {
      switch (int.options.getSubcommand()) {
        case "invite": return slashSponsorInvite(int, true);
        case "uninvite": return slashSponsorInvite(int, false);
        default: throw new Error("Unhandled Subcommand - /sponsor");
      }
    } catch (error) {
      u.errorHandler(error, int);
    }
  }
})

// Handle sponsor pings
.addEvent("messageCreate", async (msg) => {
  if (!msg.author.bot && msg.guild?.id === u.sf.ldsg) {
    // sponsor pings
    for (const [sponsor, info] of u.db.sheets.sponsors) {
      if (info.enabled && info.emojiId && msg.mentions.members?.has(sponsor)) await msg.react(info.emojiId).catch(u.noop);
    }

    // trigger words
    for (const [word, emoji] of emojis) {
      if (Math.random() < 0.3 && msg.content.toLowerCase().includes(word)) await msg.react(emoji).catch(u.noop);
    }
  }
});


module.exports = Module;