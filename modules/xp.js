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
  // 1 hour plus some until the next drop
  const time = ((Math.random() * (config.xp.featherCooldown - 1)) + 1) * 60 * 60_000;
  cooltime = new Date(Date.now() + time);
  cooldown = setTimeout(() => {
    dropCode = true;
  }, time);
}

function DEBUGFeatherPrime(msg) {
  dropCode = true;
  clearTimeout(cooldown);
  msg.react("👌");
}

function DEBUGFeatherState(msg) {
  msg.reply(
    `Current State: ${dropCode ? "Ready" : "On Cooldown"}\n` +
    `Cooldown End: ${cooltime.toLocaleString()}`
  );
}

/** @param {Discord.Message<true>} msg */
async function featherCheck(msg) {
  if (
    !dropCode || // if primed or already reacted
    msg.channel.isDMBased() || msg.channel.permissionsFor(u.sf.ldsg)?.has("SendMessages") // only publicly postable channels
  ) return;

  try {
    if (Math.random() > config.xp.featherDropChance) return;
    dropCode = false;
    const reaction = await msg.react(u.sf.emoji.xpFeather).catch(u.noop);
    // don't let someone blocking the bot ruin the fun
    if (!reaction) return dropCode = true;
    const userReact = await msg.awaitReactions({
      maxUsers: 1,
      time: 60_000,
      filter: (r, usr) => r.emoji.id === u.sf.emoji.xpFeather && !usr.bot
    }).catch(u.noop);
    await reaction.remove();
    const finder = userReact?.first()?.users.cache.find(usr => !usr.bot);
    if (finder) {
      // do we want to give them a few ember?
      // either way they get xp
      addXp(finder.id, 3, msg.channelId);
    } else {
      // they missed it! Try again.
      return dropCode = false;
    }
    resetFeatherDrops();
  } catch (error) {
    u.errorHandler(error, "XP Feather Drop");
    resetFeatherDrops();
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
    user.bot || user.system || reaction.message.author?.bot || reaction.message.author?.system || // no fun for the bots
    !reaction.message.author || user.id === reaction.message.author.id || // no reacting to yourself. also funny business with the member object
    u.db.sheets.xpSettings.banned.has(identifier) // no banned reactions
  ) return;

  // more reactions means more xp for the poster. If it was removed we have to add it back temporarily
  const countMultiplier = await reaction.users.fetch().then(usrs => usrs.size + (add ? 0 : 1) * 1.3);

  // voice channel IDs aren't very helpful since they get replaced, so we use Voice instead
  const channelId = reaction.message.channel.type === Discord.ChannelType.GuildVoice ? "Voice" : reaction.message.channelId;

  // some emoji are worth more in certain channels
  const channelEmoji = channelSettings.get(channelId)?.emoji.has(identifier) ? 1.5 : 1;

  // add the xp to the queue
  const recipient = 0.5 * countMultiplier * channelEmoji * (add ? 1 : -1);
  const giver = 0.5 * channelEmoji * (add ? 1 : -1);
  addXp(user.id, giver, channelId);
  addXp(reaction.message.author.id, recipient, channelId);
  return { recipient, giver };
}

/** @param {Augur.AugurClient} client */
async function rankClockwork(client) {
  const ldsg = client.guilds.cache.get(u.sf.ldsg);
  if (!ldsg) throw new Error("Couldn't get LDSG - Rank Clockwork");

  // give xp to people active in voice chats
  ldsg.members.cache.filter(m => m.voice.channel && !m.voice.mute && !m.voice.deaf)
    .forEach(m => {
      // vcs get deleted, stage channels don't
      const channelId = m.voice.channel?.type === Discord.ChannelType.GuildVoice ? "Voice" : m.voice.channelId ?? "";
      return addXp(m.id, 1, channelId, true);
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
      if (user.excludeXP) continue;

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
        member.send(message).catch(u.noop);
      }
    } catch (error) {
      u.errorHandler(error, `Member Rank processing (${member.displayName} - ${member.id})`);
    }
  }
}

const Module = new Augur.Module()
.setUnload(() => active)
  .addEvent("messageReactionAdd", (reaction, user) => reactionXp(reaction, user, true))
  .addEvent("messageReactionRemove", (reaction, user) => reactionXp(reaction, user, false))
  // @ts-expect-error REMOVE THESE TWO BEFORE LAUNCH
  .addCommand({ name: "prime", process: DEBUGFeatherPrime })
  .addCommand({ name: "status", process: DEBUGFeatherState })
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
    if (!msg.poll || !(!msg.poll.resultsFinalized && newMsg.poll?.resultsFinalized) || msg.channel.type === Discord.ChannelType.GuildVoice) return;

    const sorted = [...newMsg.poll.answers.values()].sort((a, b) => a.voteCount - b.voteCount);
    // people can only get xp once per poll. no multiple answers shenanigans
    const voters = new Set();
    const hours = Math.max(1, u.moment(msg.poll.expiresTimestamp).diff(msg.createdTimestamp, "hours", false));
    const voterCount = newMsg.poll.answers.reduce((p, c) => p + c.voteCount, 0);
    // assign xp to people who voted, favoring those with the right answer
    for (let i = 0; i < sorted.length; i++) {
      const answer = sorted[i];
      if (answer.voteCount === 0) continue;
      const people = await answer.fetchVoters();
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