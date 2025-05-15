// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  u = require("../utils/utils"),
  axios = require('axios'),
  Jimp = require('jimp'),

  buttermelonFacts = require('../data/buttermelonFacts.json'),
  /** @type {Record<string, string>} */
  emojiKitchenSpecialCodes = require("../data/emojiKitchenSpecialCodes.json"),
  emojiSanitizeHelp = require('node-emoji'),
  mineSweeperEmojis = ['0⃣', '1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '💣'];

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunColor(int) {
  // get input or random color
  const colorCode = int.options.getString("color") || "#" + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  // In the case that we have a string in 0xABCDEF format
  /** @type {string | number} */
  let colorCSS = colorCode.replace('0x', "#");
  try {
    // make sure it is a valid color, and not just defaulting to black
    if (!["#000000", "black", "#000000FF"].includes(colorCSS)) colorCSS = Jimp.cssColorToHex(colorCSS);
    if (colorCSS === 255) {
      return int.reply({ content: `Sorry, I couldn't understand the color \`${colorCode}\``, flags: ["Ephemeral"] });
    }
    await int.deferReply();
    // make and send the image
    const img = new Jimp(256, 256, colorCSS);
    return int.editReply({ files: [await img.getBufferAsync(Jimp.MIME_JPEG)] });
  } catch (error) {
    const content = `Sorry, I couldn't understand the color \`${colorCode}\``;
    if (int.replied || int.deferred) return int.editReply({ content }).then(u.clean);
    int.reply({ content, flags: ["Ephemeral"] });
  }
}

// global hbs stuff
/** @type {Record<string, { emoji: string, beats: string, looses: string }>} */
const hbsValues = {
  'Buttermelon': { emoji: `<:buttermelon:${u.sf.emoji.buttermelon}>`, beats: "Handicorn", looses: "Sloth" },
  'Handicorn': { emoji: `<:handicorn:${u.sf.emoji.handicorn}>`, beats: "Sloth", looses: "Buttermelon" },
  'Sloth': { emoji: `<:slothmare:${u.sf.emoji.slothmare}>`, beats: "Buttermelon", looses: "Handicorn" }
};
let storedChooser = '';
let storedChoice = '';

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunHBS(int) {
  const mode = int.options.getString("mode") || "user";
  const choice = int.options.getString("choice", true);
  const chooser = int.user.toString();
  const botLobby = int.client.getTextChannel(u.sf.channels.botSpam);
  /** @type {{ user: string, choice: string }} */
  let challenged;
  if (mode === "user") {
    if (!storedChoice) {
      storedChooser = chooser;
      storedChoice = choice;
      int.reply({ content: `Your fighter has been picked! ${int.channelId !== u.sf.channels.botSpam ? `Check ${botLobby} to see the results!` : ""}`, flags: ["Ephemeral"] });
      return botLobby?.send("## Handicorn, Buttermelon, Sloth, Fight!\n" +
      `${chooser} has chosen their fighter and is awaiting a challenger. Respond using </fun hbs:${u.sf.commands.slashFun}>.`);
    } else if (storedChooser === chooser) {
      storedChoice = choice;
      int.reply({ content: `Your fighter has been updated! ${int.channelId !== u.sf.channels.botSpam ? `Check ${botLobby} to see the results!` : ""}`, flags: ["Ephemeral"] });
      return botLobby?.send("## Handicorn, Buttermelon, Sloth, Fight!\n" +
      `${chooser} has changed their fighter and is awaiting a challenger.  Respond using </fun hbs:${u.sf.commands.slashFun}>.`
      );
    }

    challenged = { user: storedChooser, choice: storedChoice };
    // reset stored values
    storedChooser = '';
    storedChoice = '';
  } else {
    challenged = { user: int.client.user.toString(), choice: u.rand(Object.keys(hbsValues)) };
  }
  return int.reply({ content: "## Handicorn, Buttermelon, Sloth, Fight!\n" +
      `🥊 ${chooser} challenged ${challenged.user}!\n` +
      hbsResult(chooser, choice, challenged.user, challenged.choice),
  allowedMentions: { parse: ["users"] } });
}

/**
 * function hbsResult
 * @param {string} chooser1 a string to represent who made choice 1
 * @param {string} choice1 chooser1's "Handicorn", "Buttermelon", or "Sloth" choice
 * @param {string} chooser2 ...
 * @param {string} choice2 ...
 * @return {string} a summary including who picked what and who won.
 */
function hbsResult(chooser1, choice1, chooser2, choice2) {
  let response = `🤼 ${chooser1} picked ${hbsValues[choice1].emoji}, ${chooser2} picked ${hbsValues[choice2].emoji}.\n### `;
  if (choice1 === choice2) {
    response += "🤝 It's a tie!";
  } else if (hbsValues[choice1].beats === choice2) {
    response += `🏆 ${chooser1} wins!`;
  } else {
    response += `😵‍💫 ${chooser1} looses!`;
  }
  return response;
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunAcronym(int) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  // input or number between 3 and 5
  const len = int.options.getInteger("length") || Math.floor(Math.random() * 3) + 3;

  /** @type {import("profanity-matcher") | undefined} */
  const pf = int.client.moduleManager.shared.get("01-filter.js")?.();
  if (!pf) throw new Error("Couldn't access profanity filter");

  /** @type {string[]} */
  let wordgen = [];

  // try a bunch of times
  for (let ignored = 0; ignored < len * len; ignored++) {
    // make an acronym
    for (let i = 0; i < len; i++) {
      wordgen.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    const word = wordgen.join("");
    // see if it has any bad words
    if (pf.scan(word.toLowerCase()).length === 0) {
      return int.reply(`I've always wondered what __**${word}**__ stood for...`);
    }
    wordgen = [];

  }
  return int.reply("I've always wondered what __**IDUTR**__ stood for...");// cannonically it hearby stands for "IDiUT eRror"
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunMinesweeper(int) {
  let edgesize, mineCount, preclickCount;
  switch (int.options.getString("difficulty", true)) {
    case "Hard":
      edgesize = [10, 18];
      mineCount = 60;
      preclickCount = 6;
      break;
    case "Medium":
      edgesize = [10, 10];
      mineCount = 30;
      preclickCount = 4;
      break;
    default:
      edgesize = [5, 5];
      mineCount = 5;
      preclickCount = 4;
      break;
  }
  // override with manual numbers if given
  edgesize[0] = int.options.getInteger("width") || edgesize[0];
  edgesize[1] = int.options.getInteger("height") || edgesize[1];
  mineCount = int.options.getInteger("minecount") || mineCount;
  preclickCount = int.options.getInteger("preclickcount") || preclickCount;
  // x and y lengths (for custom dimensions)
  const [width, height] = edgesize;
  preclickCount = Math.min(width * height, preclickCount);
  mineCount = Math.min(width * height - preclickCount, mineCount);
  // Create a 2d array for the board
  const board = new Array(height).fill([]).map(() => {return new Array(width).fill(0);});
  // Convert the 2d array to a 2d index array
  const spaces = board.map((r, y) => {
    const row = new Array(width + 1);
    row[0] = y;
    r.forEach((_, x) => {row[x + 1] = x;});
    return row;
  });
  // place mines
  for (let i = 0; i < mineCount; i++) {
    // Get a random position
    const rownum = Math.floor(Math.random() * spaces.length);
    const row = spaces[rownum];
    const y = row[0];
    const slotnum = Math.floor(Math.random() * (row.length - 1)) + 1;
    const x = row[slotnum];
    // Set the value to a mine
    board[y][x] = 9;
    // Remove from possible mine spaces
    row.splice(slotnum, 1);
    if (row.length === 1) {
      spaces.splice(rownum, 1);
    }
    // Increment all spots around it
    for (let incrementx = Math.max(0, x - 1); incrementx < Math.min(width, x + 2); incrementx++) {
      for (let incrementy = Math.max(0, y - 1); incrementy < Math.min(height, y + 2); incrementy++) {
        board[incrementy][incrementx]++;
      }
    }
  }

  for (let i = 0; i < preclickCount; i++) {
    // Get a random position
    const rownum = Math.floor(Math.random() * spaces.length);
    const row = spaces[rownum];
    const y = row[0];
    const slotnum = Math.floor(Math.random() * (row.length - 1)) + 1;
    const x = row[slotnum];
    // expose it
    board[y][x] = -1 - board[y][x];
    // Remove from non-special-spaces
    row.splice(slotnum, 1);
    if (row.length === 1) {
      spaces.splice(rownum, 1);
    }
  }
  // seperate into rows and emojify and hide if not exposed
  const rowStrings = board.map(row => row.map(num => num < 0 ? mineSweeperEmojis[-num - 1] : `||${mineSweeperEmojis[Math.min(num, 9)]}||`).join(""));

  if (!int.channel?.isSendable()) {
    return int.reply({ content: `I can't figure out where to put the board in here, try again in another channel like <#${u.sf.channels.botSpam}>`, flags: ["Ephemeral"] });
  }
  await int.reply(`**Mines: ${mineCount}**`);
  const messages = [""];
  let messageCount = 0;
  let tagpairs = 0;
  // max of 200 spoiler tags per message, split into as many as needed
  rowStrings.forEach((row) => {
    if (tagpairs + (width * 2) > 199) {
      tagpairs = 0;
      messageCount++;
      messages[messageCount] = "";
    }
    tagpairs += width * 2;
    messages[messageCount] += row + "\n";
  });
  // send the messages in order
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    await int.channel.send(msg);
    i++;
  }
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunRoll(int) {
  // get inputs
  const dice = int.options.getInteger('dice') || 1;
  const sides = int.options.getInteger('sides') || 6;
  const modifier = int.options.getInteger('modifier') || 0;
  if (dice > 10000) {
    return int.reply({ content: "I'm not going to roll *that* many dice... 🙄", flags: ["Ephemeral"] });
  }
  // calculate rolls
  /** @type {number[]} */
  const rolls = [];
  for (let i = 0; i < dice; i++) {
    rolls.push(Math.ceil(Math.random() * sides));
  }
  // make it visually pleasing
  const total = rolls.reduce((p, c) => p + c, 0) + modifier;
  let rollStr = "";
  const maxShown = 20;
  if (rolls.length > maxShown + 3) {
    const extra = rolls.length - maxShown;
    const reduced = rolls.filter((r, i) => i < maxShown);
    rollStr = `${reduced.join(" + ")}, + ${extra} more`;
  } else {
    rollStr = rolls.join(" + ");
  }
  const modStr = modifier > 0 ? ` + ${modifier}` : modifier ? ` - ${Math.abs(modifier)}` : "";
  const summary = `${rollStr ? ` (**1d${sides}**: ${rollStr})` : ""}${modStr ? `**${modStr}**` : ""}`;
  // send visually pleasing result
  return int.reply(`You rolled ${dice}d${sides}${modStr} and got \`${total}\`!\n ${summary}`);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFun8ball(int) {
  const question = int.options.getString("question", true);
  if (!question.endsWith("?")) {
    return int.reply({ content: "You need to ask me a question, silly.", flags: ["Ephemeral"] });
  }
  const outcomes = [
    "It is certain.",
    "It is decidedly so.",
    "Without a doubt.",
    "Yes - definitely.",
    "You may rely on it.",
    "As I see it, yes.",
    "Most likely.",
    "Outlook good.",
    "Yes.",
    "Signs point to yes.",
    // the following were removed due to complaints
    // "Reply hazy, try again.",
    // "Ask again later.",
    // "Better not tell you now.",
    // "Cannot predict now.",
    // "Concentrate and ask again.",
    "Don't count on it.",
    "My reply is no.",
    "My sources say no.",
    "Outlook not so good.",
    "Very doubtful."
  ];
  return int.reply(`❓: \`${question}\`\n` +
    `🎱: \`${u.rand(outcomes)}\``
  );
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunRepost(int) {
  if (!int.channel) {
    return int.reply({ content: "I don't know where here is, so I can't find anything to repost... try in a more normal channel.", flags: ["Ephemeral"] });
  }
  await int.deferReply();
  const latest = (await int.channel.messages.fetch({ limit: 100 })).filter(m => m.attachments.size > 0 || m.embeds.some(embed => embed.image || embed.video)).first();
  if (!latest) {
    return int.editReply("I couldn't find anything in the last 100 messages to repost.").then(u.clean);
  }
  return int.editReply({
    content: 'repost that? ok!',
    files: latest.attachments.map(a => a.url),
    embeds: latest.embeds.filter(embed => embed.image || embed.video)
  });
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunButtermelon(int) {
  return int.reply(`🍌 ${u.rand(buttermelonFacts)}`);
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunQuote(int) {
  const url = "https://zenquotes.io/api/random";
  await int.deferReply();
  // @ts-ignore
  const response = await axios({ url, method: "get" }).catch((/** @type {axios.AxiosError} */ e) => {
    throw new Error(`axios error: ${e.status}\n${e.message}`);
  });
  const data = (typeof response.data === "string" ? JSON.parse(response.data) : response.data)[0] || false;
  const embed = u.embed();
  if (data) {
    embed.setAuthor({ name: data.a })
      .setDescription(data.q)
      .setTimestamp(null);
  } else {
    embed.setAuthor({ name: "ChainSword20000" })
      .setDescription("A developer uses dark mode because bugs are attracted to light, but wouldn't that put the bugs in the code instead of the background?");
  }
  return int.editReply({ embeds: [embed] });
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunNamegame(int) {
  // fun shenanigans (basically check if member is partial (which it probably isnt 99% of the time))
  const user = int.member && "displayName" in int.member ? int.member.displayName : int.user.displayName;
  let name = (int.options.getString("name") || user)
    .replace(/[^a-zA-Z]/g, '_')// just ABCabc etc, numbers were causing problems.
    .split("_")[0];// and just one segment
  name = name.charAt(0).toUpperCase() + name.slice(1);
  try {
    const url = `https://thenamegame-generator.com/lyrics/${name}.html`;
    await int.deferReply();
    // @ts-ignore
    const response = await axios({ url, method: "get" }).catch(u.noop);
    if (!response) {
      return int.editReply(`I couldn't generate lyrics for ${name}.\nPerhaps you can get it yourself from https://thenamegame-generator.com.`).then(u.clean);
    }

    // parse the song
    const song = /<blockquote>\n(.*)<\/blockquote>/g.exec(response?.data)?.[1]?.replace(/<br ?\/>/g, "\n");

    // make sure its safe
    /** @type {import("profanity-matcher") | undefined} */
    const pf = int.client.moduleManager.shared.get("01-filter.js")?.();
    if (!pf) throw new Error("Couldn't access profanity filter");

    const profane = pf.scan(song?.toLowerCase().replace(/\n/g, " ") ?? "").length;
    if (!song) {
      return int.editReply("I uh... broke my voice box. Try a different name?").then(u.clean);
    } else if (profane > 0) {
      return int.editReply("Let's try a different one...").then(u.clean);
    }
    const embed = u.embed().setTitle(`🎶 The Name Game! ${name}! 🎵`).setDescription(song);
    return int.editReply({ embeds: [embed] });
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunChoose(int) {
  const optionsArg = int.options.getString("options", true);
  if (optionsArg && optionsArg.includes("|")) {
    const options = optionsArg.split("|");
    const prefixes = ["I choose", "I pick", "I decided"];
    return int.reply(`Out of the options \`${optionsArg}\`, ${u.rand(prefixes)} **${u.rand(options).trim()}**`);
  }
  return int.reply({ content: 'you need to give me two or more choices! `a | b`', flags: ["Ephemeral"] });

}
/**
 * @param {string} emoji unsanitized/irregular emoji input
 */
function emojiSanitize(emoji) {
  let ucode = emojiSanitizeHelp.find(emoji)?.emoji ?? emoji;
  ucode = emojiKitchenSpecialCodes[ucode] ?? ucode;
  return ucode;
}
/** @param {string} emoji */
function emojiCodePointify(emoji) {
  return (emojiSanitizeHelp.find(emoji)?.emoji ?? emoji)
    .split(/\u200D/)
    .map(char => char.codePointAt(0)?.toString(16)).join("-");
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunGrow(int) {
  try {
    // get the inputs
    await int.deferReply();
    const emojiInput = int.options.getString("emoji", true);
    const emoji1 = emojiSanitize(emojiInput);
    // custom emoji embiggening
    const idExtractRegx = /^<(a?):(.*):(\d+)>/i;
    const match = idExtractRegx.exec(emojiInput);
    if (match) {
      // eslint-disable-next-line no-unused-vars
      const [_, gif, name, id] = match;
      return int.editReply({ files: [{ attachment: `https://cdn.discordapp.com/emojis/${id}.${gif ? 'gif' : 'png'}?size=512`, name: name + "Fullres." + (gif ? 'gif' : 'png') }] });
    }

    // default emoji embiggening
    const e1CP = emojiCodePointify(emoji1);
    // @ts-ignore
    const image = await axios(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${e1CP}.svg`).catch(u.noop);
    if (image?.status !== 200) return int.editReply(`For some reason I couldn't enlarge ${emojiInput}.`).then(u.clean);
    return int.editReply(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${e1CP}.png`);
  } catch (error) {
    u.errorHandler(error);
  }
}

/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunMerge(int) {
  try {
    // get the inputs
    await int.deferReply();
    const emoji1input = int.options.getString("emoji1", true).trim();
    const emoji2input = int.options.getString("emoji2", true).trim();
    const emoji1 = emojiSanitize(emoji1input);
    // attempt to merge
    const emoji2 = emojiSanitize(emoji2input);
    // @ts-ignore
    const results = await axios(`https://tenor.googleapis.com/v2/featured?key=${config.api.tenor}&client_key=emoji_kitchen_funbox&q=${emoji1}_${emoji2}&collection=emoji_kitchen_v6&contentfilter=high`).catch(u.noop);
    const url = results?.data?.results[0]?.url;
    if (url) {
      return int.editReply({ files: [{ attachment: url, name: "combined.png" }] });
    }
    if ((emoji1input + emoji2input).includes("<:")) return int.editReply("I can't combine custom emojis! Try again with some default ones.").then(u.clean);
    return int.editReply(`For some reason I couldn't combine ${emoji1} and ${emoji2}.`).then(u.clean);
  } catch (error) {
    u.errorHandler(error);
  }
}

/** @param {Discord.Message|Discord.PartialMessage} msg */
function buttermelonEdit(msg) {
  if (msg.channel.isDMBased() && (msg.cleanContent?.toLowerCase() === "test")) {
    msg.reply((Math.random() < 0.8 ? "pass" : "fail"));
  }
  const exclude = [u.sf.channels.minecraft.category];
  const roll = Math.random();
  if (roll < 0.3 && !msg.author?.bot && !exclude.includes(msg.channel.id)) {
    // let banana = /[bß8ƥɓϐβбБВЬЪвᴮᴯḃḅḇÞ][a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+([nⁿńňŋƞǹñϰпНhийӣӥѝνṅṇṉṋ]+[a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+){2}/ig;
    if (msg.content?.toLowerCase().includes("bananas")) {
      if (roll < 0.1) {
        msg.reply({ files: ['media/buttermelonsMan.jpeg'] }).catch(u.noop);
      } else {
        msg.reply("*buttermelons").catch(u.noop);
      }
    } else if (msg.content?.toLowerCase().includes("banana")) {
      if (roll < 0.06) {
        msg.reply({ files: ['media/buttermelonPile.png'] }).catch(u.noop);
      } else if (roll < 0.1) {
        msg.reply({ files: ['media/buttermelonMan.jpeg'] }).catch(u.noop);
      } else {
        msg.reply("*buttermelon").catch(u.noop);
      }
    }
  }
}

const Module = new Augur.Module()
.addInteraction({
  name: "fun",
  id: u.sf.commands.slashFun,
  options: { registry: "slashFun" },
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    switch (subcommand) {
      case "roll": return slashFunRoll(int);
      case "8ball": return slashFun8ball(int);
      case "repost": return slashFunRepost(int);
      case "mines": return slashFunMinesweeper(int);
      case "minesadvanced": return slashFunMinesweeper(int);
      case "acronym": return slashFunAcronym(int);
      case "hbs": return slashFunHBS(int);
      case "color": return slashFunColor(int);
      case "buttermelon": return slashFunButtermelon(int);
      case "quote": return slashFunQuote(int);
      case "namegame": return slashFunNamegame(int);
      case "choose": return slashFunChoose(int);
      case "grow": return slashFunGrow(int);
      case "merge": return slashFunMerge(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  }
})
.addEvent("messageCreate", buttermelonEdit)
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (oldMsg.partial || !(oldMsg.cleanContent.toLowerCase().includes("banana"))) {
    buttermelonEdit(msg);
  }
})
.setInit((data) => {
  if (data) {
    storedChoice = data.storedChoice;
    storedChooser = data.storedChooser;
  }
})
.setUnload(() => {
  return { storedChoice, storedChooser };
// })
// .addEvent(
//   "messageReactionAdd",
//   (reaction) => { // could have (reaction, user) as args but lint don't like unused var.
//     if ((reaction.message.channel.id == u.sf.channels.memes) && (reaction.emoji.name == "♻️")) { //memes channel id will have to be added if this is to be enabled, I don't know if it is still needed or even used by anyone.
//       reaction.remove();
//       reaction.message.react("⭐").catch(u.errorHandler);
//     }
});

module.exports = Module;
