// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  u = require("../utils/utils"),
  axios = require('axios'),
  Jimp = require('jimp'),
  profanityFilter = require("profanity-matcher"),
  buttermelonFacts = require('../data/buttermelonFacts.json'),
  emojiKitchenSpecialCodes = require("../data/emojiKitchenSpecialCodes.json"),
  emojiSanitizeHelp = require('node-emoji'),
  mineSweeperEmojis = ['0⃣', '1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '💣'];

/**
 * function hug
 * @param {Discord.ChatInputCommandInteraction} int a /fun hug interaction
 */
async function hug(int) {
  const hugs = [
    "http://24.media.tumblr.com/72f1025bdbc219e38ea4a491639a216b/tumblr_mo6jla4wPo1qe89guo1_1280.gif",
    "https://media.tenor.com/Uw927NM469EAAAAi/there-cheer.gif"
  ];
  const hugee = int.options.getUser("hugee", true);
  try {
    const hugImg = u.rand(hugs);
    hugee.send({ content:`Incoming hug from **${int.user.username}**!`, files: [{ attachment:hugImg, name:"hug.gif" }] });
    // alternatively:
    // return int.reply({ content:`**${int.user.username}** hugs **${hugee}**!`, files: [{ attachment:hugImg, name:"hug.gif" }] });
    // or just remove the .addSubcommand(hug) line from slashFun.js.
  } catch (e) {
    return int.reply(`I couldn't send a hug to ${hugee.displayName}. Maybe they blocked me? :shrug:`);
  }
  return int.reply("Hug on the way!");
}
/**
 * function allthe
 * @param {Discord.ChatInputCommandInteraction} int a /fun allthe interaction
 */
async function allthe(int) {
  const thing = int.options.getString('thing') || "";
  int.reply({ content:`${int.user.username}:\nALL THE ${thing.toUpperCase()}!`, files: [{ attachment:"https://cdn.discordapp.com/emojis/250348426817044482.png", name:"allthe.png" }] });
}
/**
 * function rollOldInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollOld interaction
 */
async function rollOldInt(int) {
  await int.deferReply();
  const rollsolts = rollOld(int.options.getString('rollformula'));
  return int.editReply(rollsolts.discordMsg ?? rollsolts.useroutput);
}
/** @typedef {{ total:number, rolls:string[], useroutput:string, discordMsg?: string | Discord.MessagePayload | Discord.InteractionEditReplyOptions }} RollSolt *///Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
/**
 * function rollOld
 * @param {String | null} rollFormula roll formula in old !roll format
 * @returns {RollSolt} 
 */
function rollOld(rollFormula) {
  if (!rollFormula) rollFormula = "1d6";
  rollFormula = rollFormula.toLowerCase().replace(/-/g, "+-").replace(/ /g, "");
  const diceFormulas = rollFormula.split("+");
  /** @typedef {{num: number, type: "mod"|"norm"|"fate"|"Error", sides: number, sign:1|-1, formula: string, rolls:number[], total:number}} DisectedDie */
  /** @type {DisectedDie[]} */
  const disectedDice = [];
  let totalRolls = 0;
  for (const formula of diceFormulas){
    /** @type {DisectedDie} */
    let ret = { type: "Error", num: NaN, sides:NaN, sign:1, formula:formula, rolls:[], total:0};
    const signlessFormula=formula.replace("-","");
    ret.sign=formula.startsWith("-") ? -1:1;
    if (signlessFormula.includes("d")) {
      if (!signlessFormula.includes("f")) {
        ret.type="norm";
        ret.num=parseInt(signlessFormula.split("d")[0],10);
        ret.sides=parseInt(signlessFormula.split("d")[1],10);
      } else {
        ret.type="fate";
        ret.num=parseInt(signlessFormula.split("d")[0],10);
        ret.sides=3;
      }
    } else {
      ret.type="mod";
      ret.num=1;
      ret.sides=parseInt(signlessFormula,10);
    }
    if (Object.values(ret).includes(NaN)) {
      ret.type="Error"
      disectedDice.push(ret);
    } else {
      totalRolls+=ret.num;
      disectedDice.push(ret);
    }
  }
  const maxArrayLen = 112813858; // found via trial and error, and found to have some weird bugs in the nodejs system.
  if (totalRolls > maxArrayLen) {
    return { total:0, rolls:[], useroutput: `I litterally can't roll that many dice... software limit is ${maxArrayLen} total rolls. (also note that at that number the total also overflows and starts counting up from -that number...)`};
  }
  let total = 0;
  let allRolls = [];
  let errors = [];
  for (const disectedDie in disectedDice) {
    const die = disectedDice[disectedDie];
    switch (die.type) {
      case "norm":
        die.total=0;
        die.rolls=[];
        for (let rollNum = 0; rollNum < die.num; rollNum++) {
          const roll = Math.ceil(Math.random() * die.sides) * die.sign;
          die.total+=roll;
          die.rolls.push(roll);
        }
        total += die.total;break;
      case "fate":
        die.total=0;
        die.rolls=[];
        for (let rollNum = 0; rollNum < die.num; rollNum++) {
          const roll = (Math.floor(Math.random() * die.sides) - Math.floor(die.sides/2)) * die.sign;
          die.total+=roll;
          die.rolls.push(roll);
        }
        total += die.total;break;
      case "mod":
        die.total=die.sides;
        die.rolls=[die.sides];
        total+=die.total;
      case "Error":errors.push(die);break;
    }
  }
  if (disectedDice.length > 0) {
    const maxStringLen = 536870888;
    function addData(bufferPair,newData) {
      console.log("save");
      if (bufferPair.stringableContent && (bufferPair.stringableContent.length + newData.length > maxStringLen)) {
        bufferPair.stringableContent=null;
      } else {
        bufferPair.stringableContent+=newData;
      }
      bufferPair.supposedBufferLength+=newData.length;
      bufferPair.buffer = Buffer.concat([bufferPair.buffer,Buffer.from(newData)])
      return bufferPair;  
    }
    const goodRolls = disectedDice.filter((v)=>v.type!="Error");
    const errorRolls = errors;
    // const tmp = goodRolls[0].rolls.join(" + ");
    // console.log(tmp);
    const responseHead = 
`You rolled \`${goodRolls.map((roll) => roll.formula).join("+")}\` and got:
**${total}**` + 
(errorRolls.length > 0 ? `\n\nThe following formulas don't make sense to me:
\`\`\`${errorRolls.map((roll) => roll.formula).join("+")}\`\`\``:"");
    /** @type {{ buffer:Buffer, supposedBufferLength:number, stringableContent:string|null }} */
    const rollSolts = { buffer:Buffer.from(""), supposedBufferLength:0, stringableContent:"" };
    goodRolls.forEach(die => {
      let pendingData = die.formula + "=>" + die.total + "(";
      console.log("hi")
      die.rolls.forEach((roll,index) => {
        pendingData+=roll;
        if (index !== die.rolls.length-1) {
          pendingData+=" + "
          if (pendingData.length > maxStringLen/2) {
            addData(rollSolts, pendingData)
            pendingData="";
          }
        }
      })
      console.log("ho")
      pendingData+=") + \n";
      addData(rollSolts, pendingData);
      pendingData="";
      console.log("har")
    });
    const rollsoltsEndOfMessage = "\n" + (goodRolls.length>0 ? `Here is the equasion for the good rolls:\`\`\`\n`
      + (rollSolts.stringableContent ?? "ERROR") + "```":"")
    const fullResponse = responseHead + rollsoltsEndOfMessage;
    if (fullResponse.length < 2000 && rollSolts.stringableContent) {
      return { total:total, rolls:allRolls, useroutput:fullResponse};  
    }
    console.log(fullResponse.length + rollSolts.supposedBufferLength);
    const maxDiscordChars = 10000000*2;
    if (fullResponse.length + rollSolts.supposedBufferLength < maxDiscordChars) {
      return { total:total, rolls:allRolls, useroutput:responseHead, discordMsg:{content:responseHead, files:[{attachment:rollSolts.buffer, name:"rollsolts.txt"}]} };
    }
    return { total:total, rolls:allRolls, useroutput:responseHead+"\nThere were so many rolls I can't even attatch all of them in a file. ~"+(fullResponse.length + rollSolts.supposedBufferLength)+" chars(max of ~"+maxDiscordChars+" chars)"};
  } else {
    return { total:0, rolls:[], useroutput:"nothing you gave me made sense enough to roll."};
  }
}
/**
 * function rollFInt
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollF interaction
 */
async function rollFInt(int) {
  await int.deferReply();
  const rollsolts = rollf(int.options.getInteger('dice'), int.options.getInteger('modifier'));
  return int.reply(rollsolts.useroutput);
}
/**
 * function rollf
 * @param int dice number of dice to roll (defaults to 1)
 * @param int modifier modifier to add to roll result (defaults to 0)
 * @returns {RollSolt} Object with 3 key/value pairs. total, an int with the total of all of the rolls; rolls, an int[] with the result of each roll; and useroutput, output or error in human readable format
 */
function rollf(dice, modifier) {
  if (!dice) dice = 1;
  if (!modifier) modifier = 0;
  const rolls = [];
  const num = dice;
  if (num && num <= 4294967293) {
    for (let i = 0; i < num; i++) {
      rolls.push((Math.floor(Math.random() * 3) - 1));
    }
  } else {
    return { total:0, rolls:[], useroutput:"I litterally can't roll that many dice... software limit is 4294967293." };
  }
  if (rolls.length > 0) {
    const response = `You rolled ` + dice + `df and got:\n${rolls.reduce((c, d) => c + d, 0)}`
    + ((rolls.length > 20) ? "" : ` (${rolls.join(", ")})`);
    return { total:rolls.reduce((c, d) => c + d, 0), rolls:rolls.map((v) => v+""), useroutput:response };
  } else {
    return { total:0, rolls:[], useroutput:"you didn't give me anything to roll." };
  }
}
const Module = new Augur.Module()
.addInteraction({
  name: "chain",
  id: u.sf.commands.slashChain,
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    switch (subcommand) {
      case "rollf": return rollFInt(int);
      case "rollop": return rollOldInt(int);
      case "allthe": return allthe(int);
      case "hug": return hug(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  }
});
module.exports = Module;
