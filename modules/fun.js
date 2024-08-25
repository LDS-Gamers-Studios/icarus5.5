const Augur = require("augurbot"),
  u = require("../utils/utils");
const emoji = require('../utils/emojiCharacters.js');
// const Module = new Augur.Module()
// .addCommand({name: "acronym",
//   description: "Get a random 3-5 letter acronym. For science.",
//   aliases: ["word"],
//   category: "Silly",
//   process: (msg) => {
//     let alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z"];
//     let len = Math.floor(Math.random() * 3) + 3;
//     let profanityFilter = require("profanity-matcher");
//     let pf = new profanityFilter();
//     let word = [];

//     while (word.length == 0) {
//       for (var i = 0; i < len; i++) {
//         word.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
//       }
//       word = word.join("");

//       if (pf.scan(word.toLowerCase()).length == 0) {
//         u.botSpam(msg).send("I've always wondered what __**" + word + "**__ stood for...");
//       } else {
//         word = [];
//       }
//     }
//   },
// })
// .addCommand({name: "allthe",
//   description: "ALL THE _____!",
//   syntax: "something",
//   category: "Silly",
//   process: (msg, suffix) => {
//     u.clean(msg, 0);
//     if (suffix) msg.channel.send(`${(msg.member ? msg.member.displayName : interaction.user.username)}:\nALL THE ${suffix.toUpperCase()}!`, {files: ["https://cdn.discordapp.com/emojis/250348426817044482.png"]});
//   }
// })
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
// .addCommand({name: "hbs",
//   description: "Handicorn, Buttermelon, Sloth!",
//   syntax: "handicorn | buttermelon | sloth",
//   aliases: ["rps", "bhs", "sbh", "bsh", "hsb", "shb"],
//   category: "Silly",
//   process: (msg, suffix) => {
//     let userPick = suffix.toLowerCase()[0];
//     if (userPick && ["b", "h", "s"].includes(userPick)) {
//       let icarusPick = u.rand(["b", "h", "s"]);
//       let options = {
//         "b": { emoji: "<:buttermelon:305039588014161921>", value: 0},
//         "h": { emoji: "<:handicorn:305038099254083594>", value: 1},
//         "s": { emoji: "<:sloth:305037088200327168>", value: 2}
//       };

//       let diff = options[icarusPick].value - options[userPick].value;
//       let response = `You picked ${options[userPick].emoji}, I picked ${options[icarusPick].emoji}. `;

//       if (diff == 0) {
//         msg.reply(response + "It's a tie!"); // TIE
//       } else if ((diff == -1) || (diff == 2)) {
//         msg.reply(response + "I win!");
//       } else {
//         msg.reply(response + "You win!");
//       }
//     } else {
//       msg.reply("you need to tell me what you pick: handicorn, buttermelon, or sloth!").then(u.clean);
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
// .addCommand({name: "minesweeper",
//   description: "Play a game of Minesweeper!",
//   aliases: ["mines", "sweeper"],
//   category: "Silly",
//   syntax: "[easy | medium | hard]",
//   process: (msg, suffix) => {
//     let size = 0;
//     let mineCount = 0;

//     suffix = suffix.toLowerCase();
//     if (suffix.startsWith("e")) {
//       size = mineCount = 5;
//     } else if (suffix.startsWith("m") || suffix === "") {
//       size = 10;
//       mineCount = 30;
//     } else if (suffix.startsWith("h")) {
//       size = 14;
//       mineCount = 60;
//     } else {
//       msg.channel.send("Invalid difficulty. `easy`, `medium`, and `hard` are valid.");
//       return;
//     }

//     // Getting all possible board spaces
//     let possibleSpaces = Array.from({ length: size * size }, (v, k) => k);
//     // Remove 4 corners, corners can't be mines
//     possibleSpaces.splice((size * size) - 1, 1);
//     possibleSpaces.splice((size - 1) * size, 1);
//     possibleSpaces.splice(size - 1, 1);
//     possibleSpaces.splice(0, 1);
//     // Finding out where the mines will be
//     let mineSpaces = [];
//     for (let i = 0; i < mineCount; i++) {
//       const random = Math.floor(Math.random() * possibleSpaces.length);
//       mineSpaces.push(possibleSpaces[random]);
//       possibleSpaces.splice(random, 1);
//     }

//     function getMineCount(x, y) {
//       let count = 0;
//       for (let i = -1; i <= 1; i++) {
//         if ((x + i) < 0 || (x + i) >= size) continue;
//         for (let j = -1; j <= 1; j++) {
//           if ((y + j) < 0 || (y + j) >= size) continue;
//           if (mineSpaces.includes((y + j) * size + x + i)) count++;
//         }
//       }

//       return count;
//     }

//     // Creating the final board
//     let board = [];
//     for (let x = 0; x < size; x++) {
//       board.push([]);
//       for (let y = 0; y < size; y++) {
//         if (mineSpaces.includes(x + (y * size))) {
//           board[x].push(9);
//           continue;
//         }
//         board[x].push(getMineCount(x, y));
//       }
//     }

//     let output = board.map(row => row.map(num => `||${num == 9 ? "💣" : emoji[num]}||`).join("")).join("\n");

//     msg.channel.send(`**Mines: ${mineCount}** (Tip: Corners are never mines)\n${output}`);
//   }
// })

  
// .addEvent("messageReactionAdd", (reaction, user) => {
//   if ((reaction.message.channel.id == "121755900313731074") && (reaction.emoji.name == "♻️")) {
//     reaction.remove();
//     reaction.message.react("⭐").catch(u.noop);
//   }
// });
/**
 * function rollOldInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollOld interaction
 */
async function rollOldInt(int) {
  const rollsolts = rollOld(int.options.getString('rollsInOldFormat'));
  return await int.editReply(rollsolts.useroutput);
}
/**
 * function rollOld
 * @param string rolls roll formula in old !roll format
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
async function rollOld(rollFormula) {
  if (!rollFormula) rollFormula = "1d6";
    rollFormula = rollFormula.toLowerCase().replace(/-/g, "+-").replace(/ /g, "");
    let diceExp = /(\d+)?d\d+(\+-?(\d+)?d?\d+)*/;
    let dice = diceExp.exec(rollFormula);
    let fateExp = /(\d+)?df(\+-?\d+)?/i;
    let fate = fateExp.exec(rollFormula);
    if (dice) {
      let exp = dice[0].replace(/\+-/g, "-");
      dice = dice[0].split("+");

      let rolls = [];
      let total = 0;

      dice.forEach((d, di) => {
        rolls[di] = [];
        if (d.includes("d")) {
          let add = (d.startsWith("-") ? -1 : 1);
          if (add == -1) d = d.substr(1);
          if (d.startsWith("d")) d = `1${d}`;
          let exp = d.split("d");
          let num = parseInt(exp[0], 10);
          if (num && num <= 100) {
            for (var i = 0; i < num; i++) {
              let val = Math.ceil(Math.random() * parseInt(exp[1], 10)) * add;
              rolls[di].push((i == 0 ? `**${d}:** ` : "") + val);
              total += val;
            };
          } else {
            return {"total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄"};
          }
        } else {
          total += parseInt(d, 10);
          rolls[di].push(`**${d}**`);
        }
      });
      if (rolls.length > 0) {
        let response = `${interaction.user} rolled ${exp} and got:\n${total}`
          + ((rolls.reduce((a, c) => a + c.length, 0) > 20) ? "" : ` ( ${rolls.reduce((a, c) => a + c.join(", ") + "; ", "")})`);
          return {"total":total, "rolls":rolls, "useroutput":response};
      } else
      return {"total":0, "rolls":0, "useroutput":"you didn't give me anything to roll."};
    } else if (fate) {
      let exp = fate[0].replace(/\+-/g, "-");
      dice = fate[0].split("+");

      let rolls = [];
      dice.forEach(d => {
        if (d.includes("df")) {
          let add = (d.startsWith("-") ? -1 : 1);
          if (add == -1) d = d.substr(1);
          if (d.startsWith("df")) d = `1${d}`;
          let num = parseInt(d, 10);
          if (num && num <= 100)
            for (var i = 0; i < num; i++) rolls.push( (Math.floor(Math.random() * 3) - 1) * add );
          else {
            return {"total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄"};
          }
        } else rolls.push(parseInt(d, 10));
        return {"total":total, "rolls":rolls, "useroutput":response};
      });
      if (rolls.length > 0) {
        let response = `${interaction.user} rolled ${exp} and got:\n${rolls.reduce((c, d) => c + d, 0)}`
          + ((rolls.length > 20) ? "" : ` (${rolls.join(", ")})`);
      } else
      return {"total":0, "rolls":0, "useroutput":"you didn't give me anything to roll."};
    } else
      return {"total":0, "rolls":0, "useroutput":"that wasn't a valid dice expression."};
  }
/**
 * function rollFInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollF interaction
 */
async function rollFInt(int) {
  const rollsolts = rollf(int.options.getInteger('dice'),options.getInteger('modifier'));
  return await int.editReply(rollsolts.useroutput);
}
/**
 * function rollf
 * @param int dice number of dice to roll (defaults to 1)
 * @param int modifier modifier to add to roll result (defaults to 0)
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
async function rollf(dice, modifier) {
  if (!dice) dice=1
  if (!modifier) modifier=0
  let rolls = [];
  let num = dice;
  if (num && num <= 100)
    for (var i = 0; i < num; i++) rolls.push( (Math.floor(Math.random() * 3) - 1) * add );
  else {
    return {"total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄"};
  }
  if (rolls.length > 0) {
    let response = `${interaction.user} rolled ${exp} and got:\n${rolls.reduce((c, d) => c + d, 0)}`
    + ((rolls.length > 20) ? "" : ` (${rolls.join(", ")})`);
    return {"total":total, "rolls":rolls, "useroutput":response};
  } else
    return {"total":0, "rolls":0, "useroutput":"you didn't give me anything to roll."}; 
}
/**
 * function rollInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun roll interaction
 */
async function rollInt(int) {
  const rollsolts = roll(int.options.getInteger('dice'),options.getInteger('sides'),options.getInteger('modifier'));
  return await int.editReply(rollsolts.useroutput);
}
  /**
 * function roll
 * @param int dice number of dice to roll (defaults to 1)
 * @param int sides side count of dice (defaults to 6)
 * @param int modifier modifier to add to roll result (defaults to 0)
 * @returns {int total, int[] rolls, string useroutput} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
  async function roll(dice, sides, modifier) {
    if (!dice) dice=1
    if (!sides) sides=6
    if (!modifier) modifier=0
    let rolls = [];
    let total = 0;
    di = sides
    d = dice
    rolls[di] = [];
    let add = (d.startsWith("-") ? -1 : 1);
    if (add == -1) d = d.substr(1);
    if (d.startsWith("d")) d = `1${d}`;
    let exp = d.split("d");
    let num = parseInt(exp[0], 10);
    if (num && num <= 100) {
      for (var i = 0; i < num; i++) {
        let val = Math.ceil(Math.random() * parseInt(exp[1], 10)) * add;
        rolls[di].push((i == 0 ? `**${d}:** ` : "") + val);
        total += val;
      };
    } else {
      return {"total":0, "rolls":0, "useroutput":"I'm not going to roll *that* many dice... 🙄"};
    }
    if (modifier) {
      total += parseInt(d, 10);
      rolls[di].push(`**${d}**`);
    }
    if (rolls.length > 0) {
      let response = `${interaction.user} rolled ${exp} and got:\n${total}`
        + ((rolls.reduce((a, c) => a + c.length, 0) > 20) ? "" : ` ( ${rolls.reduce((a, c) => a + c.join(", ") + "; ", "")})`);
      return {"total":total, "rolls":rolls, "useroutput":response};
    } else
      return {"total":0, "rolls":0, "useroutput":"you didn't give me anything to roll."}; 
  }
  /**
 * function ball8
 * @param {Discord.ChatInputCommandInteraction} int a /fun 8ball interaction
 */
  async function ball8(int) {
    question = int.options.getString("question")
    if (!question || !question.endsWith("?")) {
      return await int.editReply("you need to ask me a question, silly.")
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
      return await int.editReply("You asked "+question+".\nThe 8ball replies:\n"+u.rand(outcomes));
    }
  }
  /**
 * function repost
 * @param {Discord.ChatInputCommandInteraction} int a /fun repost interaction
 */
  async function repost(int) {
    const repost = int.channel.messages.cache.filter(m => m.attachments.size > 0)
    .last();
    return await int.editReply(repost);
  }


const Module = new Augur.Module()
.addInteraction({
  name: "fun",
  id: u.sf.commands.slashFun,
  onlyGuild: false,
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ ephemeral: true });
    switch (subcommand) {
      case "roll": return rollInt(int);
      case "rollf": return rollFInt(int);
      case "rollOld": return rollOldInt(int);
      case "8ball": return ball8(int);
      case "repost": return repost(int);
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
});

module.exports = Module;