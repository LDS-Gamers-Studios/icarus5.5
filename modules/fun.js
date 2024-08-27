const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  mineSweeperEmojis = { 0:'0⃣', 1:'1⃣', 2:'2⃣', 3:'3⃣', 4:'4⃣', 5:'5⃣', 6:'6⃣', 7:'7⃣', 8:'8⃣', 9:'9⃣', 10:'🔟', "bomb":`💣` };
// const Module = new Augur.Module()
// .addCommand({name: "color",
//   description: "Show what a color looks like.",
//   syntax: "color (e.g. `#003B6F` or `blue`)",
//   category: "Silly",
//   process: async (msg, suffix) => {
//     if (suffix) {
//       try {
//         const Jimp = require("jimp");

//         let color;
//         if (suffix.startsWith('0x')) {
//           // In the case that we have a string in 0xABCDEF format
//           color = "#" + suffix.substr(2);
//         } else color = suffix;
//         if (!["#000000", "black", "#000000FF"].includes(color))
//           color = Jimp.cssColorToHex(color);
//         if (color != 255) {
//           let img = new Jimp(256, 256, color);
//           msg.channel.send({files: [await img.getBufferAsync(Jimp.MIME_PNG)]});
//         } else {
//           msg.reply(`sorry, I couldn't understand the color "${suffix}"`).then(u.clean);
//         }
//       } catch(error) {
//         msg.reply(`sorry, I couldn't understand the color "${suffix}"`).then(u.clean);
//       }
//     } else {
//       msg.reply("you need to tell me a color!").then(u.clean);
//     }
//   }
// })
// .addCommand({name: "hug",
//   description: "Send a much needed hug.",
//   syntax: "<@user(s)>",
//   info: "Sends someone a hug via direct message.",
//   category: "Silly",
//   permissions: msg => msg.guild,
//   process: async (msg, suffix) => {
//     u.clean(msg);
//     if (msg.mentions.users.size > 0) {
//       let hugs = [
//         "http://24.media.tumblr.com/72f1025bdbc219e38ea4a491639a216b/tumblr_mo6jla4wPo1qe89guo1_1280.gif",
//         "https://cdn.discordapp.com/attachments/96335850576556032/344202091776049152/hug.gif"
//       ];

//       msg.channel.send("Hug" + ((msg.mentions.users.size > 1) ? "s" : "") + " on the way!").then(u.clean);

//       for (const [id, user] of msg.mentions.users) {
//         try {
//           let hug = u.rand(hugs);
//           user.send(`Incoming hug from **${interaction.user.username}**!`, {files: [{"attachment": hug, "name": "hug.gif"}]})
//           .catch(e => {
//             msg.reply(`I couldn't send a hug to ${msg.guild.members.cache.get(user.id).displayName}. Maybe they blocked me? :shrug:`).then(u.clean);
//           });
//         } catch(e) { u.errorHandler(e, msg); }
//       }
//     } else {
//       msg.reply("who do you want to hug?").then(u.clean);
//     }
//   }
// })
const hbsValues = {
  "Buttermelon": { emoji: ":buttermelon:1277852466175676489", value: 0 },
  "Handicorn": { emoji: ":handicorn:1277852541224488990", value: 1 },
  "Sloth": { emoji: ":sloth:", value: 2 }
};
function hbsChooseRandom() {
  return u.rand(Object.keys(hbsValues));
}
let cachedChooser = 'Icarus';
let cachedChoice = hbsChooseRandom();
async function hbsInt(int) {
  const tosend = hbs(int.options.getString("vsmode"), int.options.getString("choice"), "<@" + int.user + ">");
  int.deleteReply();
  int.channel.send(tosend);
}
function hbs(mode, choice, chooser) {
  switch (mode) {
    case ("setstored"):
      cachedChooser = chooser;
      cachedChoice = choice;
      return "I have cached a choice by " + chooser + ", awaiting a challenge.";
    case ("vsstored"): {
      const oldCachedChooser = cachedChooser;
      const olcCachedChoice = cachedChoice;
      cachedChooser = 'Icarus';
      cachedChoice = hbsChooseRandom();
      return chooser + " challenged " + oldCachedChooser + "!\n" + hbsResult(oldCachedChooser, olcCachedChoice, chooser, choice);
    }
    default:
    case ("vsicarus"): {
      const aiChoice = hbsChooseRandom();
      // console.log("choice");
      // console.log(choice);
      return chooser + " challenged Icarus!\n" + hbsResult("Icarus", aiChoice, chooser, choice);
    }
  }
  function hbsResult(chooser1, choice1, chooser2, choice2) {
    let response = chooser1 + " picked " + hbsValues[choice1].emoji + ", " + chooser2 + " picked " + hbsValues[choice2].emoji + ".\n";
    const diff = hbsValues[choice2].value - hbsValues[choice1].value;
    if (diff == 0) {
      response += "It's a tie!";// TIE
    } else if ((diff == -1) || (diff == 2)) {
      response += chooser2 + " wins!";
    } else {
      response += chooser1 + " wins!";
    }
    return response;
  }
}

async function allthe(int) {
  const thing = int.options.getString('thing');
  int.editReply({ content:`${int.user.username}:\nALL THE ${thing.toUpperCase()}!`, files: [{ attachment:"https://cdn.discordapp.com/emojis/250348426817044482.png", name:"allthe.png" }] });
}
async function acronymInt(int) {
  return int.editReply(acronym());
}
function acronym() {
  const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z"];
  const len = Math.floor(Math.random() * 3) + 3;
  const profanityFilter = require("profanity-matcher");
  const pf = new profanityFilter();
  let word = [];

  while (word.length == 0) {
    for (let i = 0; i < len; i++) {
      word.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    word = word.join("");

    if (pf.scan(word.toLowerCase()).length == 0) {
      return "I've always wondered what __**" + word + "**__ stood for...";
    } else {
      word = [];
    }
  }
}
async function minesweeperInt(int) {
  let size, mineCount;
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
  const field = minesweeper(size, mineCount);
  let degradingField = field;
  function countEmoji(text) {
    const emojiRegex = new RegExp(`(${Object.values(mineSweeperEmojis).map(emoji => emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, 'g');
    const emoji = text.match(emojiRegex);
    return emoji?.length || 0;
  }
  if (countEmoji(field) <= 99) {
    return int.editReply(field); // No splitting needed
  }
  while (countEmoji(degradingField) > 99) {
    let segment = "";
    // console.log("addMessage");
    // console.log("\"" + degradingField + "\"");
    while (countEmoji(segment + degradingField.substring(0, degradingField.indexOf("\n"))) <= 99) {
      // console.log("addLineToMessage");
      // console.log("\"" + segment + "\"");
      // console.log("\"" + degradingField + "\"");
      segment += degradingField.substring(0, degradingField.indexOf("\n") + 1);
      degradingField = degradingField.substring(degradingField.indexOf("\n") + 1);
    }
    if (segment + degradingField == field) {
      await int.editReply(segment);
    } else {
      await int.channel.send(segment);
    }
  }
  return int.channel.send(degradingField);
}
function minesweeper(size, mineCount) {
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

  function getMineCount(x, y) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      if ((x + i) < 0 || (x + i) >= size) continue;
      for (let j = -1; j <= 1; j++) {
        if ((y + j) < 0 || (y + j) >= size) continue;
        if (mineSpaces.includes((y + j) * size + x + i)) count++;
      }
    }

    return count;
  }

  // Creating the final board
  const board = [];
  for (let x = 0; x < size; x++) {
    board.push([]);
    for (let y = 0; y < size; y++) {
      if (mineSpaces.includes(x + (y * size))) {
        board[x].push(9);
        continue;
      }
      board[x].push(getMineCount(x, y));
    }
  }
  const output = board.map(row => row.map(num => `||${num == 9 ? mineSweeperEmojis["bomb"] : mineSweeperEmojis[num]}||`).join("")).join("\n");
  console.log(output);
  return (`**Mines: ${mineCount}** (Tip: Corners are never mines)\n${output}`);
}


/**
 * function rollOldInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollOld interaction
 */
async function rollOldInt(int) {
  const rollsolts = rollOld(int.options.getString('rollformula'));
  return int.editReply(rollsolts.useroutput);
}
/**
 * function rollOld
 * @param string rolls roll formula in old !roll format
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
function rollOld(rollFormula) {
  if (!rollFormula) rollFormula = "1d6";
  rollFormula = rollFormula.toLowerCase().replace(/-/g, "+-").replace(/ /g, "");
  const diceExp = /(\d+)?d\d+(\+-?(\d+)?d?\d+)*/;
  let dice = diceExp.exec(rollFormula);
  const fateExp = /(\d+)?df(\+-?\d+)?/i;
  const fate = fateExp.exec(rollFormula);
  if (dice) {
    const exp = dice[0].replace(/\+-/g, "-");
    dice = dice[0].split("+");

    const doneRolls = [];
    let total = 0;

    dice.forEach((formula, rollCount) => {
      doneRolls[rollCount] = [];
      if (formula.includes("d")) {
        const add = (formula.startsWith("-") ? -1 : 1);
        if (add == -1) formula = formula.substr(1);
        if (formula.startsWith("d")) formula = `1${formula}`;
        const formulaParts = formula.split("d");
        const num = parseInt(formulaParts[0], 10);
        if (num && num <= 10000) {
          for (let i = 0; i < num; i++) {
            const val = Math.ceil(Math.random() * parseInt(formulaParts[1], 10)) * add;
            doneRolls[rollCount].push((i == 0 ? `**${formula}:** ` : "") + val);
            total += val;
          }
        } else {
          return { "total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄" };
        }
      } else {
        total += parseInt(formula, 10);
        rollCount[rollCount].push(`**${formula}**`);
      }
    });
    if (doneRolls.length > 0) {
      const response = `You rolled ${exp} and got:\n${total}`
          + ((doneRolls.reduce((a, c) => a + c.length, 0) > 20) ? "" : ` ( ${doneRolls.reduce((a, c) => a + c.join(", ") + "; ", "")})`);
      return { "total":total, "rolls":doneRolls, "useroutput":response };
    } else {
      return { "total":0, "rolls":0, "useroutput":"you didn't give me anything to roll." };
    }
  } else if (fate) {
    const exp = fate[0].replace(/\+-/g, "-");
    dice = fate[0].split("+");

    const rolls = [];
    dice.forEach(d => {
      if (d.includes("df")) {
        const add = (d.startsWith("-") ? -1 : 1);
        if (add == -1) d = d.substr(1);
        if (d.startsWith("df")) d = `1${d}`;
        const num = parseInt(d, 10);
        if (num && num <= 10000) {
          for (let i = 0; i < num; i++) {
            rolls.push((Math.floor(Math.random() * 3) - 1) * add);
          }
        } else {
          return { "total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄" };
        }
      } else {
        rolls.push(parseInt(d, 10));
      }
    });
    if (rolls.length > 0) {
      const response = `You rolled ${exp} and got:\n${rolls.reduce((c, d) => c + d, 0)}`
          + ((rolls.length > 20) ? "" : ` (${rolls.join(", ")})`);
      return { "total":rolls.reduce((c, d) => c + d, 0), "rolls":rolls, "useroutput":response };
    } else {
      return { "total":0, "rolls":0, "useroutput":"you didn't give me anything to roll." };
    }
  } else {
    return { "total":0, "rolls":0, "useroutput":"that wasn't a valid dice expression." };
  }
}
/**
 * function rollFInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollF interaction
 */
async function rollFInt(int) {
  const rollsolts = rollf(int.options.getInteger('dice'), int.options.getInteger('modifier'));
  return int.editReply(rollsolts.useroutput);
}
/**
 * function rollf
 * @param int dice number of dice to roll (defaults to 1)
 * @param int modifier modifier to add to roll result (defaults to 0)
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
function rollf(dice, modifier) {
  if (!dice) dice = 1;
  if (!modifier) modifier = 0;
  const rolls = [];
  const num = dice;
  if (num && num <= 10000) {
    for (let i = 0; i < num; i++) {
      rolls.push((Math.floor(Math.random() * 3) - 1));
    }
  } else {
    return { "total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄" };
  }
  if (rolls.length > 0) {
    const response = `You rolled ` + dice + `df and got:\n${rolls.reduce((c, d) => c + d, 0)}`
    + ((rolls.length > 20) ? "" : ` (${rolls.join(", ")})`);
    return { "total":rolls.reduce((c, d) => c + d, 0), "rolls":rolls, "useroutput":response };
  } else {
    return { "total":0, "rolls":0, "useroutput":"you didn't give me anything to roll." };
  }
}
/**
 * function rollInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun roll interaction
 */
async function rollInt(int) {
  const rollsolts = roll(int.options.getInteger('dice'), int.options.getInteger('sides'), int.options.getInteger('modifier'));
  // console.log("rollsolts")
  // console.log(rollsolts)
  // console.log(rollsolts.useroutput)
  return int.editReply(rollsolts.useroutput);
}
/**
 * function roll
 * @param int dice number of dice to roll (defaults to 1)
 * @param int sides side count of dice (defaults to 6)
 * @param int modifier modifier to add to roll result (defaults to 0)
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
function roll(dice, sides, modifier) {
  if (!dice) dice = 1;
  if (!sides) sides = 6;
  if (!modifier) modifier = 0;
  const rolls = [];
  let total = 0;
  rolls[sides] = [];
  const num = dice;
  if (num && num <= 10000) {
    for (let i = 0; i < num; i++) {
      const val = Math.ceil(Math.random() * parseInt(sides, 10));
      rolls[sides].push((i == 0 ? "**d" + sides + ":** " : "") + val);
      total += val;
    }
  } else {
    return { "total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄" };
  }
  if (modifier) {
    total += parseInt(dice, 10);
    rolls[sides].push(`**${dice}**`);
  }
  if (rolls.length > 0) {
    const response = "You rolled " + dice + `d` + sides + ` and got:\n${total}`
        + ((rolls.reduce((a, c) => a + c.length, 0) > 20) ? "" : ` ( ${rolls.reduce((a, c) => a + c.join(", ") + "; ", "")})`);
    return { "total":total, "rolls":rolls, "useroutput":response };
  } else {
    return { "total":0, "rolls":0, "useroutput":"you didn't give me anything to roll." };
  }
}
/**
 * function ball8
 * @param {Discord.ChatInputCommandInteraction} int a /fun 8ball interaction
 */
async function ball8(int) {
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
    return int.editReply("You asked :\"" + question + "\"\nThe 8ball replies:\n" + u.rand(outcomes));
  }
}
/**
 * function repost
 * @param {Discord.ChatInputCommandInteraction} int a /fun repost interaction
 */
async function repost(int) {
  const messages = (await int.channel.messages.fetch({ limit: 100 }));
  const filtered = messages.filter(m => m.attachments.size > 0);
  // console.log('msgmngr');
  // console.log(int.channel.messages);
  // console.log('msgfetched');
  // console.log(messages);
  // console.log('fltrdmsgs');
  // console.log(filtered);
  // console.log('lastmsg');
  // console.log(filtered.last());
  if (filtered.size < 1) {
    return int.editReply("I couldn't find anything in the last 100 messages to repost.");
  }
  // console.log(int.channel.messages.cache.filter(m => m.attachments.size > 0)
  //   .last()
  //   .attachments.first());
  // console.log(int.channel.messages.cache.filter(m => m.attachments.size > 0)
  //   .last()
  //   .attachments.first().url);

  const imgToRepost = filtered
    .last()
    .attachments.first().url;
  return int.editReply(imgToRepost);
}


const Module = new Augur.Module()
.addInteraction({
  name: "fun",
  id: u.sf.commands.slashFun,
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply(); // { ephemeral: true });
    switch (subcommand) {
      case "roll": return rollInt(int);
      case "rollf": return rollFInt(int);
      case "rollold": return rollOldInt(int);
      case "8ball": return ball8(int);
      case "repost": return repost(int);
      case "mines": return minesweeperInt(int);
      case "acronym": return acronymInt(int);
      case "allthe": return allthe(int);
      case "hbs": return hbsInt(int);
      default: return int.editReply("thats an error, this command isn't registered properly. ping a bot admin please.");
      // case "birthday": return runBirthday(int);
      // case "banner": {
      //   int.editReply("Setting banner...");
      //   const response = await setBanner(int.options.getString("file", true));
      //   if (response) int.editReply(response);
      // }
    }
  },
  // autocomplete: (int) => {
  //   const option = int.options.getFocused();
  //   const files = fs.readdirSync(path.resolve(__dirname + "/../media/banners"))
  //     .filter(file => file.endsWith(".png") && file.includes(option))
  //     .map(f => f.substring(0, f.length - 4));
  //   int.respond(files.slice(0, 24).map(f => ({ name: f, value: f })));
  // }
}).addEvent(
  "messageReactionAdd",
  (reaction) => { // could have (reaction, user) as args but lint don't like unused var.
    if ((reaction.message.channel.id == u.sf.channels.memes) && (reaction.emoji.name == "♻️")) {
      reaction.remove();
      reaction.message.react("⭐").catch(u.noop);
    }
  });

module.exports = Module;