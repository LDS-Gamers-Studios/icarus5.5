// @ts-check
const Discord = require("discord.js");
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const mc = require("../utils/modCommon");
const Rank = require("../utils/rankInfo");
const config = require("../config/config.json");

/**
 * @typedef XPDropSettings
 * @prop {Date} [cooltime]
 * @prop {any} [cooldown] it's actually a timeout
 * @prop {number} count
 * @prop {boolean} drop
 */

/**
 * @typedef ActiveUser
 * @prop {number} multiplier
 * @prop {string} channelId
 * @prop {string} discordId
 * @prop {boolean} isVoice
 * @prop {boolean} isMessage
 */

/** @type {Discord.Collection<number, string>} */
// rank level up rewards
let rewards = new u.Collection();

/** @type {Discord.Collection<string, import("../database/sheets").ChannelXPSetting>} */
let channelSettings = new u.Collection();

/** @type {Set<string>} */
// There can be "channel of the week" style events, where that channel is worth more xp
const highlights = new Set();

/** @type {Discord.Collection<string, number>} */
// people can buy and place xp lures that work similar to the ones in pokemon go
const lures = new u.Collection();

/** @type {Discord.Collection<string, ActiveUser[]>} */
// people getting xp
const active = new u.Collection();

// Feather drop settings
let cooltime = new Date();
let cooldown;
let dropCode = false;

function resetFeatherDrops() {
  // rand(x) hours until the next drop
  const time = ((Math.random() * (config.xp.featherCooldown - 1)) + 1) * 60 * 60_000;
  cooltime = new Date(Date.now() + time);
  cooldown = setTimeout(() => {
    dropCode = true;
  }, time);
}

function DEBUGFeatherPrime(msg) {
  dropCode = true;
  clearTimeout(cooldown);
  msg.react("👌").catch(u.noop);
}

function DEBUGFeatherState(msg) {
  msg.reply(
    `Current State: ${dropCode ? "Ready" : "On Cooldown"}\n` +
    `Cooldown End: ${u.time(cooltime, "F")}`
  );
}

/** @param {Discord.Message<true>} msg */
async function featherCheck(msg) {
  const lureCount = lures.get(msg.channelId) ?? 0;
  const dropMode = lureCount === 0;
  if (
    !(dropCode || lureCount > 0) || // only if it's primed or they have a lure placed
    msg.channel.isDMBased() || !msg.channel.permissionsFor(u.sf.ldsg)?.has("SendMessages") // only publicly postable channels
  ) return;

  try {
    // chances of a feather dropping is pretty low unless they have a lure
    if (Math.random() > (config.xp.featherDropChance * (lureCount + 1))) return;
    if (dropMode) dropCode = false;
    const reaction = await msg.react(u.sf.emoji.xpFeather).catch(u.noop);

    // don't let someone blocking the bot ruin the fun
    if (!reaction) {
      if (dropMode) dropCode = true;
      return;
    }

    // wait for reactions
    const userReact = await msg.awaitReactions({
      maxUsers: 1,
      time: 60_000,
      filter: (r, usr) => r.emoji.id === u.sf.emoji.xpFeather && !usr.bot
    }).catch(u.noop);

    // oop we got a hit!
    await reaction.users.remove(msg.client.user.id);
    const finder = userReact?.first()?.users.cache.find(usr => !usr.bot);
    if (finder) {
      // give em ember if they didn't buy their way in
      if (dropMode) {
        const value = 5 * Math.ceil(Math.random() * 4);
        u.db.bank.addCurrency({
          currency: "em",
          description: `XP feather drop in #${msg.channel.name}`,
          discordId: finder.id,
          giver: msg.client.user.id,
          hp: true,
          value
        });
        const house = u.getHouseInfo(msg.guild.members.cache.get(finder.id));
        const embed = u.embed({ author: finder })
          .setColor(house.color)
          .addFields(
            { name: "House", value: house.name }
          )
          .setDescription(`${finder} found an <:xpfeather:${u.sf.emoji.xpFeather}> in ${msg.url} and got <:ember:${u.sf.emoji.ember}>${value}!`);

        msg.client.getTextChannel(u.sf.channels.mopbucketawards)?.send({ embeds: [embed] });
      }

      // give em xp
      addXp(finder.id, 3, msg.channelId);
    } else {
      // they missed it! Try again.
      if (dropMode) dropCode = true;
      return;
    }
    if (dropMode) resetFeatherDrops();
  } catch (error) {
    u.errorHandler(error, `XP Feather Drop - Mode: ${dropMode ? "Drop" : "Lure"}`);
    if (dropMode) resetFeatherDrops();
  }
}

/**
 * Standardizes the XP adding
 * @param {string} discordId
 * @param {number} multiplier
 * @param {string} channelId
 * @param {boolean} isVoice
 * @param {boolean} isMessage
 */
function addXp(discordId, multiplier, channelId, isVoice = false, isMessage = false) {
  /** @type {ActiveUser} */
  const obj = { multiplier, channelId, discordId, isVoice, isMessage };
  active.ensure(discordId, () => []).push(obj);
  return obj;
}

/**
 * @param {Discord.PartialMessageReaction | Discord.MessageReaction} reaction
 * @param {Discord.User | Discord.PartialUser} user
 * @param {Boolean} add
 */
async function reactionXp(reaction, user, add = true) {
  // sometimes it doesn't actually fetch within augur. annoying.
  await reaction.message.fetch();
  await reaction.message.member?.fetch();

  // check if custom id, then check if unicode emoji
  const identifier = reaction.emoji.id ?? reaction.emoji.name ?? "";

  if (
    !reaction.message.inGuild() || // must be in the server
    user.bot || user.system || reaction.message.author?.bot || reaction.message.author?.system || // no fun for the bots
    !reaction.message.author || user.id === reaction.message.author.id || // no reacting to yourself. also funny business with the member object
    u.db.sheets.xpSettings.banned.has(identifier) || // no banned reactions
    channelSettings.get(reaction.message.id)?.posts === 0 // no xp excluded channels
  ) return;

  // more reactions means more xp for the poster. If it was removed we have to get the pre-removal count
  const countMultiplier = await reaction.users.fetch().then(usrs => usrs.size + (add ? 0 : 1) * 1.3);

  // reactions should mean more or less depending on the channel
  const channelMultiplier = channelSettings.get(reaction.message.channelId)?.posts ?? 1;

  // voice channel IDs aren't very helpful since they get replaced, so we use Voice instead
  const channelId = reaction.message.channel.type === Discord.ChannelType.GuildVoice ? "Voice" : reaction.message.channelId;

  // some emoji are worth more in certain channels
  const channelEmoji = channelSettings.get(channelId)?.emoji.has(identifier) ? 1.5 : 1;

  // add the xp to the queue
  const recipient = 0.5 * countMultiplier * channelEmoji * channelMultiplier * (add ? 1 : -1);
  const giver = 0.5 * channelEmoji * channelMultiplier * (add ? 1 : -1);

  addXp(reaction.message.author.id, recipient, channelId);

  // if it's a public readonly, (like announcements), don't give xp to the poster
  const perms = reaction.message.channel.permissionsFor(u.sf.ldsg);
  if (perms?.has("ViewChannel") && !perms.has("SendMessages")) return;
  addXp(user.id, giver, channelId);

}

/** @param {Augur.AugurClient} client */
async function rankClockwork(client) {
  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't get LDSG - Rank Clockwork");

  // give xp to people active in voice chats
  ldsg.members.cache.filter(m => m.voice.channel && !m.voice.mute && !m.voice.deaf && m.voice.channel.members.size > 1)
    .forEach(m => {
      // vcs get deleted, stage channels don't
      const channelId = m.voice.channel?.type === Discord.ChannelType.GuildVoice ? "Voice" : m.voice.channelId ?? "No VC";
      const members = m.voice.channel?.members.size ?? 0;
      return addXp(m.id, 0.05 * Math.max(5, members), channelId, true);
    });

  // no reason to do anything
  if (active.size === 0) return;

  // reset data before saving so as to not lose anything
  const backupActive = active.clone();
  active.clear();

  // save and hand out responses
  const response = await u.db.user.addXp(backupActive);
  if (response.users.length === 0) return;

  for (const user of response.users) {
    // get member object. if none, they're prob not in the server anymore
    const member = ldsg.members.cache.get(user.discordId) ?? await ldsg.members.fetch(user.discordId).catch(u.noop);
    if (!member) continue;

    // Remind mods to trust people!
    try {
      // no need
      if (member.roles.cache.has(u.sf.roles.trusted)) continue;

      let content;
      // they posted 25 messages
      if (user.posts % 25 === 0 && backupActive.get(user.discordId)?.find(v => v.isMessage)) {
        content = `${user.posts} active minutes in chat`;
      // they were active in vc for 2 hours
      } else if (user.voice % 120 === 0 && backupActive.get(user.discordId)?.find(v => v.isVoice)) {
        content = `${user.voice} active minutes in voice chats`;
      }

      if (content) {
        // get the summary and send it with options to trust
        const embed = await mc.getSummaryEmbed(member);
        client.getTextChannel(u.sf.channels.modlogs)?.send({
          content: `${member} has had ${content} without being trusted!`,
          embeds: [embed.setFooter({ text: member.id })],
          components: [
            u.MessageActionRow().addComponents(
              new u.Button().setCustomId("timeModTrust").setEmoji("👍").setLabel("Give Trusted").setStyle(Discord.ButtonStyle.Success)
            )
          ]
        });
      }

      // Grant ranked rewards if applicable
      if (user.trackXP === u.db.user.TrackXPEnum.OFF) continue;

      const lvl = Rank.level(user.totalXP);
      const oldLvl = Rank.level(response.oldUsers.find(usr => usr.discordId === user.discordId)?.totalXP ?? user.totalXP);

      // leveled up!
      if (lvl > oldLvl) {
        let message = `${u.rand(Rank.messages)} ${u.rand(Rank.levelPhrase).replace("%LEVEL%", lvl.toString())}`;

        // rank up!
        if (rewards.has(lvl)) {
          const reward = ldsg.roles.cache.get(rewards.get(lvl) ?? "");

          // uh oh, we done goofed
          if (!reward) throw new Error(`Rank Role ${rewards.get(lvl)} couldn't be found! (${member})`);

          // out with the old and in with the new
          const has = rewards.find(r => member.roles.cache.has(r));
          if (has) await member.roles.remove(has);
          await member.roles.add(reward);

          message += `\n\nYou have been awarded the **${reward.name}** role!`;
        }
        if (user.trackXP === u.db.user.TrackXPEnum.FULL) member.send(message).catch(u.noop);
      }
    } catch (error) {
      u.errorHandler(error, `Member Rank processing (${member.displayName} - ${member.id})`);
    }
  }
}

const Module = new Augur.Module();
Module.setUnload(() => active)
  .addEvent("messageReactionAdd", (reaction, user) => reactionXp(reaction, user, true))
  .addEvent("messageReactionRemove", (reaction, user) => reactionXp(reaction, user, false))
  // mainly for debug
  .addCommand({ name: "prime", process: DEBUGFeatherPrime, onlyOwner: true })
  .addCommand({ name: "status", process: DEBUGFeatherState, onlyOwner: true })
  .addEvent("messageCreate", (msg) => {
    if (
      !msg.inGuild() || msg.guild?.id !== u.sf.ldsg || // only in LDSG
      msg.member?.roles.cache.has(u.sf.roles.muted) || // no muted allowed
      msg.author.bot || msg.author.system || msg.webhookId || // no bots
      u.parse(msg) // not a command
    ) return;

    // do a feather drop check
    featherCheck(msg);

    // different multipliers for different channels
    const channelMultiplier = channelSettings.get(msg.channelId)?.posts ?? 1;
    const mediaMultiplier = (msg.attachments.size * (channelSettings.get(msg.channelId)?.preferMedia ? 0.3 : 0)) + 1;
    const highlight = highlights.has(msg.channelId) ? 1.3 : 1;

    // time specific multipliers
    const lure = ((lures.get(msg.channelId) ?? 0) * 0.1) + 1;
    const multiplier = channelMultiplier * mediaMultiplier * highlight * lure;

    // add the xp if they haven't sent a message, or change the multiplier if they posted something of more value
    const prevMessage = active.get(msg.author.id)?.find(a => a.isMessage);
    if (prevMessage && prevMessage.multiplier < multiplier) prevMessage.multiplier = multiplier;
    else if (!prevMessage) addXp(msg.author.id, multiplier, msg.channelId, false, true);
  })
  // xp for poll votes
  .addEvent("messageUpdate", async (msg, newMsg) => {
    // see if it's a finished poll outside of a VC
    if (!msg.inGuild() || !msg.poll || !(!msg.poll.resultsFinalized && newMsg.poll?.resultsFinalized) || msg.channel.type === Discord.ChannelType.GuildVoice) return;

    // people can only get xp once per poll. no multiple answers shenanigans
    const sorted = [...newMsg.poll.answers.values()].sort((a, b) => a.voteCount - b.voteCount);
    const voters = new Set();
    const hours = Math.max(1, u.moment(msg.poll.expiresTimestamp).diff(msg.createdTimestamp, "hours", false));
    const voterCount = newMsg.poll.answers.reduce((p, c) => p + c.voteCount, 0);

    // assign xp to people who voted, favoring those with the right answer
    for (let i = 0; i < sorted.length; i++) {
      const answer = sorted[i];
      const people = await answer.fetchVoters();
      if (answer.voteCount === 0) continue;
      for (const [id, user] of people) {
        if (!voters.has(user.id) && !user.bot && !user.system) {
          voters.add(user.id);
          // factor in the percentage of voters who voted for this and how long the poll lasted
          // for example, a 24hr 2 option poll with 1/3 voters for an option would give 11.8 to that person
          // the same situation with a a 1hr poll would give 1.45 to that person
          const mult = (i + 1) * 0.3 * hours * ((people.size / voterCount) + 1) + 1;
          addXp(id, mult, msg.channelId);
        }
      }
    }
  })
  // @ts-ignore it works
  .setClockwork(() => {
    try {
      return setInterval(rankClockwork, 60_000, Module.client);
    } catch (error) {
      u.errorHandler(error, "Rank outer clockwork");
    }
  })
  .setInit(/** @param {Discord.Collection<string, ActiveUser[]>} [talking] */ async (talking) => {
    if (talking) {
      for (const [id, user] of talking) active.set(id, user);
    }
    // set rank roles
    rewards = new u.Collection(u.db.sheets.roles.map(r => [parseInt(r.level), r.base]));
    // set multipliers
    channelSettings = new u.Collection(u.db.sheets.xpSettings.channels.map(c => [c.channelId, c]));
    // start xp feather drops
    resetFeatherDrops();
  })
  .setUnload(() => active);

module.exports = Module;
