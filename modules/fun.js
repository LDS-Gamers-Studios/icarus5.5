// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  axios = require('axios'),
  jimp = require('jimp'),
  profanityFilter = require("profanity-matcher"),
  mineSweeperEmojis = ['0⃣', '1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '💣'];
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunColor(int) {
  let colorCode = int.options.getString("color");
  if (!colorCode) {
    colorCode = `#${Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0')}`;// generate random hex color
  }
  try {
    let colorCSS;
    colorCSS = colorCode.startsWith('0x') ? `#${colorCode.substring(2)}` : colorCode;// In the case that we have a string in 0xABCDEF format
    if (!["#000000", "black", "#000000FF"].includes(colorCSS)) {
      colorCSS = jimp.cssColorToHex(colorCSS);
    }
    if (colorCSS != 255) {
      const img = new jimp(256, 256, colorCSS);
      return int.editReply({ files: [await img.getBufferAsync(jimp.MIME_PNG)] });
    }
  } catch (error) {
    return int.editReply(`sorry, I couldn't understand the color ${colorCode}`);
  }
}
const hbsValues = {
  'Buttermelon': { emoji: `<:buttermelon:${u.sf.emoji.buttermelon}>`, value: 0 },
  'Handicorn': { emoji: `<:handicorn:${u.sf.emoji.handicorn}>`, value: 1 },
  'Sloth': { emoji: "<:sloth:305037088200327168>", value: 2 } // this is global so it don't need to be in snowflakes
};
let storedChooser = '';
let storedChoice = '';
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunHBS(int) {
  const mode = int.options.getString("mode");
  const choice = int.options.getString("choice") || "Handicorn";
  const chooser = `<@${int.user}>`;
  switch (mode) {
    case ("user"):
      if (!storedChoice) {
        int.deleteReply();
        storedChooser = chooser;
        storedChoice = choice;
        if (!int.channel) {
          u.wait(5000).then(() => {int.deleteReply();});
          return int.editReply(`I can't securely store this without everyone being able to see what it is in here. Try in #<${u.sf.channels.botspam}.`);
        }
        return int.channel?.send("**Handicorn, Buttermelon, Sloth, Fight!**\n" +
        `I have stored a choice by ${chooser}, awaiting a challenge.`);
      } else {
        const oldstoredChooser = storedChooser;
        const olcstoredChoice = storedChoice;
        storedChooser = '';
        storedChoice = '';
        return int.editReply("**Handicorn, Buttermelon, Sloth, Fight!**\n" +
        `${chooser} challenged ${oldstoredChooser}!\n` +
        hbsResult(chooser, choice, oldstoredChooser, olcstoredChoice));
      }
    default:
    case ("icarus"): {
      const aiChoice = u.rand(Object.keys(hbsValues));
      return int.editReply("**Handicorn, Buttermelon, Sloth, Fight!**\n" +
      chooser + " challenged Icarus!\n" +
      hbsResult(chooser, choice, "Icarus", aiChoice));
    }
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
    let response = `${chooser1} picked ${hbsValues[choice1].emoji}, ${chooser2} picked ${hbsValues[choice2].emoji}.\n`;
    const diff = hbsValues[choice2].value - hbsValues[choice1].value;
    if (diff == 0) {
      response += "It's a tie!";// TIE
    } else if ((diff == -1) || (diff == 2)) {
      response += `${chooser2} wins!`;
    } else {
      response += `${chooser1} wins!`;
    }
    return response;
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunAcronym(int) {
  const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z"];
  const len = int.options.getInteger("length") || Math.floor(Math.random() * 3) + 3;
  const pf = new profanityFilter();
  let wordgen = [];

  for (let ignored = 0; ignored < len * len; ignored++) {// try a bunch of times
    for (let i = 0; i < len; i++) {
      wordgen.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    const word = wordgen.join("");

    if (pf.scan(word.toLowerCase()).length == 0) {
      return int.editReply(`I've always wondered what __**${word}**__ stood for...`);
    } else {
      wordgen = [];
    }
  }
  return int.editReply("I ran into an error, try again and/or ping a botadmin.");
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunMinesweeper(int) {
  let size, mineCount;
  // difficulty values
  switch (int.options.getString("difficulty")) {
    case "Hard":
      size = 14;
      mineCount = 60;
      break;
    case "Medium":
      size = 10;
      mineCount = 30;
      break;
    default:
    case "Easy":
      size = 5;
      mineCount = 5;
      break;
  }
  // generate the minefield
  let field = "";
  // Getting all possible board spaces
  const possibleSpaces = Array.from({ length: size * size }, (v, k) => k);
  // Remove 4 corners, corners can't be mines
  possibleSpaces.splice((size * size) - 1, 1);
  possibleSpaces.splice((size - 1) * size, 1);
  possibleSpaces.splice(size - 1, 1);
  possibleSpaces.splice(0, 1);
  // Finding out where the mines will be
  const mineSpaces = [];
  for (let i = 0; i < mineCount; i++) {
    const random = Math.floor(Math.random() * possibleSpaces.length);
    mineSpaces.push(possibleSpaces[random]);
    possibleSpaces.splice(random, 1);
  }
  // Creating the final board
  /** @type {number[][]} */
  const board = [];
  for (let x = 0; x < size; x++) {
    board.push([]);
    for (let y = 0; y < size; y++) {
      if (mineSpaces.includes(x + (y * size))) {
        board[x].push(9);
        continue;
      }
      // count adjacent mines
      let count = 0;
      for (let i = -1; i <= 1; i++) {
        if ((x + i) < 0 || (x + i) >= size) continue;
        for (let j = -1; j <= 1; j++) {
          if ((y + j) < 0 || (y + j) >= size) continue;
          if (mineSpaces.includes((y + j) * size + x + i)) count++;
        }
      }
      board[x].push(count);
    }
  }
  const output = board.map(row => row.map(num => `||${mineSweeperEmojis[num]}||`).join("")).join("\n");
  field = (`**Mines: ${mineCount}** (Tip: Corners are never mines)\n${output}`);
  // we need to split it up because only 99 emoji per message limit for some reason.
  let degradingField = field;
  function countEmoji(text) {
    const emojiRegex = new RegExp(`(${mineSweeperEmojis.map(emoji => emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, 'g');
    const emoji = text.match(emojiRegex);
    return emoji?.length || 0;
  }
  if (countEmoji(field) <= 99) {
    return int.editReply(field); // No splitting needed
  }
  if (!int.channel) {
    return int.editReply(`I can't fit the entire minefield in here, try #<${u.sf.channels.botspam}>`);
  }
  while (countEmoji(degradingField) > 99) {
    let segment = "";
    while (countEmoji(segment + degradingField.substring(0, degradingField.indexOf("\n") >= 0 ? degradingField.indexOf("\n") : degradingField.length)) <= 99) {
      segment += degradingField.substring(0, (degradingField.indexOf("\n") >= 0 ? degradingField.indexOf("\n") : degradingField.length) + 1);
      degradingField = degradingField.substring((degradingField.indexOf("\n") >= 0 ? degradingField.indexOf("\n") : degradingField.length) + 1);
    }
    if (segment + degradingField == field) {
      await int.editReply(segment);
    } else {
      await int.channel.send(segment);
    }
  }
  return int.channel.send(degradingField);
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunRoll(int) {
  const dice = int.options.getInteger('dice') || 1;
  const sides = int.options.getInteger('sides') || 6;
  const modifier = int.options.getInteger('modifier') || 0;
  /** @type {string[]} */
  const rolls = [];
  let total = modifier;
  if (dice > 10000) {
    return int.editReply("I'm not going to roll *that* many dice... 🙄");
  } else {
    for (let i = 0; i < dice; i++) {
      const val = Math.ceil(Math.random() * sides);
      rolls.push((i == 0 ? `**d${sides}:** ` : "") + val);
      total += val;
    }
  }
  return int.editReply(`You rolled ${dice}d${sides}${modifier ? `+${modifier}` : ""} and got:\n` +
    total + (rolls.length <= 20 ? ` ( ${rolls.join(", ")}${modifier ? `; **${modifier}**` : ""} )` : ""));
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFun8ball(int) {
  const question = int.options.getString("question");
  if (!question || !question.endsWith("?")) {
    return int.editReply("you need to ask me a question, silly.");
  } else {
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
    return int.editReply(`You asked :"${question}"\n` +
      "The 8ball replies:\n" +
      u.rand(outcomes));
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunRepost(int) {
  if (!int.channel) {
    return int.editReply("I don't know where here is, so I can't find anything to repost... try in a more normal channel.");
  }
  const latest = (await int.channel.messages.fetch({ limit: 100 })).filter(m => m.attachments.size > 0 || m.embeds.some(embed => embed.image || embed.video)).first();
  if (!latest) {
    return int.editReply("I couldn't find anything in the last 100 messages to repost.");
  }
  // const imgToRepost = latest.attachments;
  return int.editReply({
    content: 'You have been charged with reposting this:',
    files: latest.attachments.map(a => a.url),
    embeds: latest.embeds.filter(embed => embed.image || embed.video)
});
}
const buttermelonFacts = require('../data/buttermelonFacts.json');
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunButtermelon(int) {
  return int.editReply(`🍌 ${u.rand(buttermelonFacts.facts)}`);
}
/** @param {Discord.ChatInputCommandInteraction} int */
function buttermelonEdit(msg) {
  if ((msg.channel.id == u.sf.channels.botspam || msg.channel.id == u.sf.channels.bottesting) && (msg.cleanContent.toLowerCase() == "test")) {
    msg.channel.send((Math.random() < 0.8 ? "pass" : "fail"));
  }
  const exclude = ['121033996439257092', '164784857296273408'];// IDK where these are so hardcoded they shall currently remain.
  const roll = Math.random();
  if (roll < 0.3 && !msg.author.bot && !exclude.includes(msg.channel.id)) {
    // let banana = /[bß8ƥɓϐβбБВЬЪвᴮᴯḃḅḇÞ][a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+([nⁿńňŋƞǹñϰпНhийӣӥѝνṅṇṉṋ]+[a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+){2}/ig;
    if (msg.content.toLowerCase().includes("bananas")) {
      if (roll < 0.1) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonsMan.jpeg')] }).catch(u.errorHandler);
      } else {
        msg.channel.send("*buttermelons").catch(u.errorHandler);
      }
    } else if (msg.content.toLowerCase().includes("banana")) {
      if (roll < 0.06) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonPile.png')] }).catch(u.errorHandler);
      } else if (roll < 0.1) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonMan.jpeg')] }).catch(u.errorHandler);
      } else {
        msg.channel.send("*buttermelon").catch(u.errorHandler);
      }
    }
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunQuote(int) {
  const url = "https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en";
  const response = await axios({ url, method: "get" }).catch((/** @type {axios.AxiosError} */ e) => {
    throw new Error(`quote command error:${e.status}`);
  });
  const data = response.data;
  if (data) {
    const randomQuote = data;
    return int.editReply(`> ${randomQuote.quoteText}\n> - ${randomQuote.quoteAuthor}`);
  } else {
    return int.editReply("> A developer uses dark mode because bugs are attracted to light, \n" +
    "> but wouldn't that put the bugs in the code instead of the background?\n" +
    "> - ChainSword20000");
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunNamegame(int) {
  let nameArg = int.options.getString("name");
  try {
    if (!nameArg) nameArg = int.user.displayName;
    nameArg = nameArg.replace(/[^a-zA-Z]/g, '_');// just ABCabc etc, numbers were causing problems.
    nameArg = nameArg.split("_")[0];// and just one segment
    const name = nameArg;
    const url = `https://thenamegame-generator.com/lyrics/${name}.html`;
    const response = await axios({ url, method: "get" }).catch((/** @type {axios.AxiosError} */ e) => {
      return int.editReply(`Could not generate lyrics for ${name}.\nPerhaps you can get it yourself from https://thenamegame-generator.com.`);
    });
    const data = response.data;
    if (data) {
      const pf = new profanityFilter();
      const lyricsUntrimmedEnd = data.substring(data.indexOf("<blockquote>") + 12);
      const lyricsTrimmedWithHtml = lyricsUntrimmedEnd.substring(0, lyricsUntrimmedEnd.indexOf("</blockquote>"));
      const results = lyricsTrimmedWithHtml.replace(/<br>/g, "\n").replace(/<br \/>/g, "\n");
      const pfresults = pf.scan(results.toLowerCase().replace(/[-\n]/g, " ").replace(/\s\s+/g, " "));
      const ispf = (pfresults.length > 0 && pfresults[0]) || (pfresults.length > 1);
      if (!ispf && (name.length <= 230) && (results.length + name.length <= 5750)) {
        const embed = u.embed().setTitle(`🎶 **The Name Game! ${name}! 🎵`).setDescription(results);
        return int.editReply({ embeds:[embed] });
      } else {
        return int.editReply("Let's try a different one...");
      }
    } else {
      return int.editReply("I uh... broke my voice box. Try a different name?");
    }
  } catch (error) { u.errorHandler(error, int); }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunChoose(int) {
  const optionsArg = int.options.getString("options");
  if (optionsArg && optionsArg.includes("|")) {
    const options = optionsArg.split("|");
    const prefixes = ["I choose", "I pick", "I decided"];
    return int.editReply(`${u.rand(prefixes)} **${u.rand(options)}**`);
  } else {
    return int.editReply('you need to give me two or more choices! "a | b"');
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunEmoji(int) {
  try {
    const unicode = require("../data/emojiUnicode.json");
    const emoji1 = int.options.getString("emoji1")?.trim();
    const emoji2 = int.options.getString("emoji2")?.trim();
    let emoji1JustName, emoji2JustName;
    let emoji1unicode, emoji2unicode;
    if (emoji1?.includes(":")) {
      emoji1JustName = emoji1?.substring(emoji1.indexOf(":") + 1);
      emoji1JustName = emoji1JustName?.substring(0, emoji1JustName.indexOf(":"));
      emoji1unicode = unicode[emoji1JustName];
    } else {
      emoji1unicode = emoji1;
    }
    if (emoji2?.includes(":")) {
      emoji2JustName = emoji2?.substring(emoji2.indexOf(":") + 1);
      emoji2JustName = emoji2JustName?.substring(0, emoji2JustName.indexOf(":"));
      emoji2unicode = unicode[emoji2JustName];
    } else {
      emoji2unicode = emoji2;
    }
    console.log(emoji1);
    console.log(emoji1JustName);
    console.log(emoji1unicode);
    return int.editReply({ files: [{ attachment:`https://emojik.vercel.app/s/${emoji1unicode}_${emoji2unicode}?size=128`, name:"combined.png" }] });
  } catch (error) { u.errorHandler(error);return int.editReply("error:" + error); }
}
const Module = new Augur.Module()
.addInteraction({
  name: "fun",
  id: u.sf.commands.slashFun,
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply(); // { ephemeral: true });
    switch (subcommand) {
      case "roll": return slashFunRoll(int);
      case "8ball": return slashFun8ball(int);
      case "repost": return slashFunRepost(int);
      case "mines": return slashFunMinesweeper(int);
      case "acronym": return slashFunAcronym(int);
      case "hbs": return slashFunHBS(int);
      case "color": return slashFunColor(int);
      case "buttermelon": return slashFunButtermelon(int);
      case "quote": return slashFunQuote(int);
      case "namegame": return slashFunNamegame(int);
      case "choose": return slashFunChoose(int);
      case "emoji": return slashFunEmoji(int);
      default:
        u.errorLog.send({ embeds: [ u.embed().setDescription(`Error, command ${int} isn't associated with anything in fun.js`)] });
        return int.editReply("Thats an error, this command isn't registered properly. I've let my devs know.");
    }
  },
})
.addEvent("message", buttermelonEdit)
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (oldMsg.partial || !(oldMsg.cleanContent.toLowerCase().includes("banana"))) {
    buttermelonEdit(msg);
  }
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