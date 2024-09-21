// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  axios = require('axios'),
  jimp = require('jimp'),
  profanityFilter = require("profanity-matcher"),
  buttermelonFacts = require('../data/buttermelonFacts.json').facts,
  emojiUnicode = require("../data/emojiUnicode.json"),
  mineSweeperEmojis = ['0⃣', '1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '💣'];
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunColor(int) {
  let colorCode = int.options.getString("color");
  // generate random hex color
  colorCode = colorCode || "#" + Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
  // In the case that we have a string in 0xABCDEF format
  let colorCSS = colorCode.replace('0x', "#");
  try {
    if (!["#000000", "black", "#000000FF"].includes(colorCSS)) colorCSS = jimp.cssColorToHex(colorCSS).toString();
    // make sure it is a valid color, and not just defaulting to black
    if (colorCSS == "255") {
      return int.editReply(`sorry, I couldn't understand the color ${colorCode}`);
    }
    const img = new jimp(256, 256, colorCSS);
    return int.editReply({ files: [await img.getBufferAsync(jimp.MIME_PNG)] });
  } catch (error) {
    return int.editReply(`sorry, I couldn't understand the color ${colorCode}`);
  }
}
const hbsValues = {
  'Buttermelon': { emoji: `<:buttermelon:${u.sf.emoji.buttermelon}>`, beats: "Handicorn", looses: "Sloth" },
  'Handicorn': { emoji: `<:handicorn:${u.sf.emoji.handicorn}>`, beats: "Sloth", looses: "Buttermelon" },
  'Sloth': { emoji: "<:sloth:305037088200327168>", beats: "Buttermelon", looses: "Handicorn" } // this is global so it don't need to be in snowflakes
};
let storedChooser = '';
let storedChoice = '';
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunHBS(int) {
  const mode = int.options.getString("mode");
  const choice = int.options.getString("choice", true);
  const chooser = int.user.toString();
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
    if (choice1 == choice2) {
      response += "It's a tie!";
    } else if (hbsValues[choice1].beats == choice2) {
      response += `${chooser1} wins!`;
    } else {
      response += `${chooser2} wins!`;
    }
    return response;
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunAcronym(int) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
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
  return int.editReply("I've always wondered what __**IDUTR**__ stood for...");// cannonically it hearby stands for "IDiUT eRror"
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunMinesweeper(int) {
  let edgesize, mineCount;
  switch (int.options.getString("difficulty", true)) {
    case "Hard":
      edgesize = [10, 18];
      mineCount = 60;
      break;
    case "Medium":
      edgesize = [10, 10];
      mineCount = 30;
      break;
    default:
      edgesize = [5, 5];
      mineCount = 5;
      break;
  }
  // x and y lengths (for mobile users)
  const [xl, yl] = edgesize;
  // Create a 2d array for the board  
  const board = new Array(yl).fill([]).map(() => {return new Array(xl).fill(0);});
  // Convert the 2d array to a 2d index array. Filter corner spots.
  const spaces = board.map((r, y) => r.map((c, x) => x).filter((c, x) => (![0, yl - 1].includes(y) && ![0, xl - 1].includes(x))));
  for (let i = 0; i < mineCount; i++) {
    // Get a random position
    const y = Math.floor(Math.random() * spaces.length);
    const x = Math.floor(Math.random() * spaces[y].length);
    // Set the value to a mine
    board[y][x] = 9;
    // Remove from possible mine spaces
    spaces[y].slice(x, 1);
    if (spaces[y].length == 0) spaces.slice(y, 1);
    // Increment all spots around it
    for (let nx = -1; nx < 2; nx++) {
      for (let ny = -1; ny < 2; ny++) {
        if (nx == xl || nx < 0 || ny == yl || ny < 0 || board[ny][nx] > 8) continue;
        board[ny][nx]++;
      }
    }
  }
  // seperate into rows and emojify
  const rowStrings = board.map(row => row.map(num => `||${mineSweeperEmojis[Math.min(num, 9)]}||`).join(""));
  if (!int.channel) {
    return int.editReply(`I can't figure out where to put the board in here, try again in another channel like <#${u.sf.channels.botspam}>`);
  }
  int.editReply(`**Mines: ${mineCount}** (Tip: Corners are never mines)`);
  const messages = [""];
  let messageCount = 0;
  let tagpairs = 0;
  rowStrings.forEach((row) => {
    if (tagpairs + (width * 2) > 199) {
      tagpairs = 0;
      messageCount++;
      messages[messageCount] = "";
    }
    tagpairs += width * 2;
    messages[messageCount] += row + "\n";
  });
  let ret;
  messages.forEach((content) => {
    ret = int.channel?.send(content);
  });
  return ret;
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
  }
  for (let i = 0; i < dice; i++) {
    const val = Math.ceil(Math.random() * sides);
    rolls.push((i == 0 ? `**d${sides}:** ` : "") + val);
    total += val;
  }
  return int.editReply(`You rolled ${dice}d${sides}${modifier ? `+${modifier}` : ""} and got:\n` +
    total + (rolls.length <= 20 ? ` ( ${rolls.join(", ")}${modifier ? `; **${modifier}**` : ""} )` : ""));
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFun8ball(int) {
  const question = int.options.getString("question", true);
  if (!question.endsWith("?")) {
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
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunButtermelon(int) {
  return int.editReply(`🍌 ${u.rand(buttermelonFacts)}`);
}
/** @param {Discord.Message|Discord.PartialMessage} msg */
function buttermelonEdit(msg) {
  if ((msg.channel.id == u.sf.channels.botspam || msg.channel.id == u.sf.channels.bottesting) && (msg.cleanContent?.toLowerCase() == "test")) {
    msg.reply((Math.random() < 0.8 ? "pass" : "fail"));
  }
  const exclude = [u.sf.channels.minecraftcategory];
  const roll = Math.random();
  if (roll < 0.3 && !msg.author?.bot && !exclude.includes(msg.channel.id)) {
    // let banana = /[bß8ƥɓϐβбБВЬЪвᴮᴯḃḅḇÞ][a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+([nⁿńňŋƞǹñϰпНhийӣӥѝνṅṇṉṋ]+[a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+){2}/ig;
    if (msg.content?.toLowerCase().includes("bananas")) {
      if (roll < 0.1) {
        msg.reply({ files: ['media/buttermelonsMan.jpeg'] }).catch(u.errorHandler);
      } else {
        msg.reply("*buttermelons").catch(u.errorHandler);
      }
    } else if (msg.content?.toLowerCase().includes("banana")) {
      if (roll < 0.06) {
        msg.reply({ files: ['media/buttermelonPile.png'] }).catch(u.errorHandler);
      } else if (roll < 0.1) {
        msg.reply({ files: ['media/buttermelonMan.jpeg'] }).catch(u.errorHandler);
      } else {
        msg.reply("*buttermelon").catch(u.errorHandler);
      }
    }
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunQuote(int) {
  const url = "https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en";
  // @ts-ignore
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
    // @ts-ignore
    const response = await axios({ url, method: "get" }).catch(() => {
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
  const optionsArg = int.options.getString("options", true);
  if (optionsArg && optionsArg.includes("|")) {
    const options = optionsArg.split("|");
    const prefixes = ["I choose", "I pick", "I decided"];
    return int.editReply(`${u.rand(prefixes)} **${u.rand(options).trim()}**`);
  } else {
    return int.editReply('you need to give me two or more choices! "a | b"');
  }
}
/** @param {Discord.ChatInputCommandInteraction} int */
async function slashFunEmoji(int) {
  try {
    const emoji1 = int.options.getString("emoji1", true).trim();
    const emoji2 = int.options.getString("emoji2", true).trim();
    let emoji1JustName, emoji2JustName;
    let emoji1unicode, emoji2unicode;
    if (emoji1?.includes(":")) {
      emoji1JustName = emoji1?.substring(emoji1.indexOf(":") + 1);
      emoji1JustName = emoji1JustName?.substring(0, emoji1JustName.indexOf(":"));
      emoji1unicode = emojiUnicode[emoji1JustName];
    } else {
      emoji1unicode = emoji1;
    }
    if (emoji2?.includes(":")) {
      emoji2JustName = emoji2?.substring(emoji2.indexOf(":") + 1);
      emoji2JustName = emoji2JustName?.substring(0, emoji2JustName.indexOf(":"));
      emoji2unicode = emojiUnicode[emoji2JustName];
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
        int.editReply("Thats an error, this command isn't registered properly. I've let my devs know.");
        throw new Error("Unhandled Subcommand");
    }
  },
})
.addEvent("messageCreate", buttermelonEdit)
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