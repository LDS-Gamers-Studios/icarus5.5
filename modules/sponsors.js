// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const snipcart = require("../utils/snipcart");
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

const discounts = new u.Collection([
  [u.sf.roles.sponsors.legendary, 20],
  [u.sf.roles.sponsors.pro, 15],
  [u.sf.roles.sponsors.onyx, 10],
  [u.sf.roles.sponsors.elite, 5]
]);

/** @param {Discord.GuildMember} member*/
function discountLevel(member) {
  let discount = { rate: 0, role: "" };

  for (const [role, rate] of discounts) {
    if (member.roles.cache.has(role)) {
      discount = { rate, role };
      break;
    }
  }

  return discount;
}

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

/**
 * @param {Discord.GuildMember} oldMember
 * @param {Discord.GuildMember} newMember
 */
async function sponsorDiscountHandler(oldMember, newMember) {
  const newLevel = discountLevel(newMember);
  const oldLevel = discountLevel(oldMember);

  if (newLevel.rate === oldLevel.rate) return;
  if (newLevel.rate === 0 && oldLevel.rate === 0) return;

  // Fetch user
  const user = await u.db.user.fetchUser(newMember.id);
  if (!user) throw new Error(`Unable to access user document for ${newMember.id}`);

  // Check if current discount exists.
  const code = parseInt(user._id.toString().substring(16), 16).toString(36).toUpperCase();
  let discount = await snipcart.getDiscountByCode(code);

  const role = newMember.guild.roles.cache.get(newLevel.role)?.name;

  const disabledText = "Even though the shop isn't up right now, the code will be valid when it returns.";
  const discountText = `Thanks for joining the ${role} ranks! As a thank you, you get a ${newLevel.rate}% discount on purchases in the LDSG shop by using code \`${code}\`. ` +
    `${disabledText} This discount will apply as long as you keep the ${role} role.\n` +
    "https://ldsgamers.com/shop";

  // Discount no longer applies. Delete.
  if (discount && newLevel.rate === 0) return snipcart.deleteDiscount(discount.id);

  // Discount has changed. Edit.
  if (discount) {
    discount = await snipcart.editDiscount(discount.id, {
      // new values
      name: `${newMember.user.username} ${role}`,
      rate: newLevel.rate,

      // existing values (required for request update)
      trigger: discount.trigger,
      code: discount.code,
      type: discount.type
    });

    if (!discount) throw new Error(`Unable to edit sponsor discount - ${newMember.id}`);

    return newMember.send(discountText).catch(u.noop);
  }

  // New discount code
  if (newLevel.rate > 0) {
    discount = await snipcart.newDiscount({
      name: `${newMember.user.username} ${role}`,
      trigger: "Code",
      code,
      type: "Rate",
      rate: newLevel.rate
    });

    if (!discount) throw new Error(`Unable to edit sponsor discount - ${newMember.id}`);

    return newMember.send(discountText).catch(u.noop);
  }
}

const Module = new Augur.Module()
.addInteraction({
  id: u.sf.commands.slashSponsor,
  onlyGuild: true,
  options: { registry: "slashSponsor" },
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
})

// Handle sponsor discounts
.addEvent("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    if (newMember.guild.id !== u.sf.ldsg) return;
    if (oldMember.partial) return; // can't do anything with incomplete data
    if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

    await sponsorDiscountHandler(oldMember, newMember);
  } catch (e) {
    u.errorHandler(e, "Sponsor discount error");
  }
});


module.exports = Module;