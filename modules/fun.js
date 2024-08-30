// @ts-check
const Augur = require(`augurbot-ts`),
  Discord = require(`discord.js`),
  u = require(`../utils/utils`),
  axios = require('axios'),
  mineSweeperEmojis = { 0:'0⃣', 1:'1⃣', 2:'2⃣', 3:'3⃣', 4:'4⃣', 5:'5⃣', 6:'6⃣', 7:'7⃣', 8:'8⃣', 9:'9⃣', 10:'🔟', 'bomb':'💣' };
/**
 * function hug
 * @param {Discord.ChatInputCommandInteraction} int a /fun hug interaction
 */
async function slashFunHug(int) {
  const hugs = [
    `http://24.media.tumblr.com/72f1025bdbc219e38ea4a491639a216b/tumblr_mo6jla4wPo1qe89guo1_1280.gif`,
    `https://media.tenor.com/Uw927NM469EAAAAi/there-cheer.gif`
  ];
  const hugee = int.options.getUser(`hugee`) || { displayName:"ERRNOUSR", send: function() {u.errorLog.send({ embeds: [ u.embed().setDescription(`error, user argument on /hug didnt exist. someone messed up slashFun.js`) ] });} };
  try {
    const hugImg = u.rand(hugs);
    hugee.send({ content:`Incoming hug from **${int.user.username}**!`, files: [{ attachment:hugImg, name:`hug.gif` }] });
    // alternatively:
    // return int.editReply({ content:`**${int.user.username}** hugs **${hugee}**!`, files: [{ attachment:hugImg, name:`hug.gif` }] });
    // or just remove the .addSubcommand(hug) line from slashFun.js.
  } catch (e) {
    return int.editReply(`I couldn't send a hug to ${hugee.displayName}. Maybe they blocked me? :shrug:`);
  }
  return int.editReply(`Hug on the way!`);
}
/**
 * function color
 * @param {Discord.ChatInputCommandInteraction} int a /fun color interaction
 */
async function slashFunColor(int) {
  let colorCode = int.options.getString(`color`);
  if (!colorCode) {
    colorCode = `#${Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0')}`;// generate random hex color
  }
  try {
    const Jimp = require(`jimp`);

    let colorCSS;
    if (colorCode.startsWith('0x')) {
      // In the case that we have a string in 0xABCDEF format
      colorCSS = `#${colorCode.substring(2)}`;
    } else {colorCSS = colorCode;}
    if (![`#000000`, `black`, `#000000FF`].includes(colorCSS)) {
      colorCSS = Jimp.cssColorToHex(colorCSS);
    }
    if (colorCSS != 255) {
      const img = new Jimp(256, 256, colorCSS);
      int.editReply({ files: [await img.getBufferAsync(Jimp.MIME_PNG)] });
    } else {
      int.editReply(`sorry, I couldn't understand the color ${colorCode}`);
    }
  } catch (error) {
    int.editReply(`sorry, I couldn't understand the color ${colorCode}`);
  }
}
const hbsValues = {
  'Buttermelon': { emoji: `<:buttermelon:${u.sf.emoji.buttermelon}>`, value: 0 },
  'Handicorn': { emoji: `<:handicorn:${u.sf.emoji.handicorn}>`, value: 1 },
  'Sloth': { emoji: `<:sloth:305037088200327168>`, value: 2 } // this is global so it don't need to be in snowflakes
};
let storedChooser = '';
let storedChoice = '';
/**
 * function slashFunHBS
 * @param {Discord.ChatInputCommandInteraction} int a /fun hbs interaction
 */
async function slashFunHBS(int) {
  const mode = int.options.getString(`mode`);
  const choice = int.options.getString(`choice`) || `Handicorn`;
  const chooser = `<@${int.user}>`;
  switch (mode) {
    case (`user`):
      if (!storedChoice) {
        int.deleteReply();
        storedChooser = chooser;
        storedChoice = choice;
        int.channel.send(`**Handicorn, Buttermelon, Sloth, Fight!**\n` +
        `I have stored a choice by ${chooser}, awaiting a challenge.`);
      } else {
        const oldstoredChooser = storedChooser;
        const olcstoredChoice = storedChoice;
        storedChooser = '';
        storedChoice = '';
        int.editReply(`**Handicorn, Buttermelon, Sloth, Fight!**\n` +
        chooser + ` challenged ${oldstoredChooser}!\n` +
        hbsResult(chooser, choice, oldstoredChooser, olcstoredChoice));
      }
      break;
    default:
    case (`icarus`): {
      const aiChoice = u.rand(Object.keys(hbsValues));
      int.editReply(`**Handicorn, Buttermelon, Sloth, Fight!**\n` +
      chooser + ` challenged Icarus!\n` +
      hbsResult(chooser, choice, `Icarus`, aiChoice));
    }
  }
  /**
 * function hbsResult
 * @param {string} chooser1 a string to represent who made choice 1
 * @param {string} choice1 a `Handicorn`, `Buttermelon`, or `Sloth` choice
 * @param {string} chooser2 a string to represent who made choice 2
 * @param {string} choice2 a `Handicorn`, `Buttermelon`, or `Sloth` choice
 * @return {string} a summarry including who picked what and who won.
 */
  function hbsResult(chooser1, choice1, chooser2, choice2) {
    let response = `${chooser1} picked ${hbsValues[choice1].emoji}, ${chooser2} picked ${hbsValues[choice2].emoji}.\n`;
    const diff = hbsValues[choice2].value - hbsValues[choice1].value;
    if (diff == 0) {
      response += `It's a tie!`;// TIE
    } else if ((diff == -1) || (diff == 2)) {
      response += `${chooser2} wins!`;
    } else {
      response += `${chooser1} wins!`;
    }
    return response;
  }
}

/**
 * function allthe
 * @param {Discord.ChatInputCommandInteraction} int a /fun allthe interaction
 */
async function slashFunAllThe(int) {
  const thing = int.options.getString('thing');
  int.editReply({ content:`${int.user.username}:\nALL THE ${thing.toUpperCase()}!`, files: [{ attachment:`https://cdn.discordapp.com/emojis/250348426817044482.png`, name:`allthe.png` }] });
}
/**
 * function slashFunAcronym
 * @param {Discord.ChatInputCommandInteraction} int a /fun acronym interaction
 */
async function slashFunAcronym(int) {
  const alphabet = [`A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K`, `L`, `M`, `N`, `O`, `P`, `Q`, `R`, `S`, `T`, `U`, `V`, `W`, `Y`, `Z`];
  const len = int.options.getInteger(`length`) || Math.floor(Math.random() * 3) + 3;
  const profanityFilter = require(`profanity-matcher`);
  const pf = new profanityFilter();
  let wordgen = [];

  for (let ignored = 0; ignored < len * len; ignored++) {// try a bunch of times
    for (let i = 0; i < len; i++) {
      wordgen.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    const word = wordgen.join(``);

    if (pf.scan(word.toLowerCase()).length == 0) {
      return int.editReply(`I've always wondered what __**${word}**__ stood for...`);
    } else {
      wordgen = [];
    }
  }
  return int.editReply(`I ran into an error, try again and/or ping a botadmin.`);
}

/**
 * function slashFunMinesweeper
 * @param {Discord.ChatInputCommandInteraction} int a /fun minesweeper interaction
 */
async function slashFunMinesweeper(int) {
  let size, mineCount;
  // difficulty values
  switch (int.options.getString(`difficulty`)) {
    case `Hard`:
      size = 14;
      mineCount = 60;
      break;
    case `Medium`:
      size = 10;
      mineCount = 30;
      break;
    default:
    case `Easy`:
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
  /** @type {number[][]} */
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
  const output = board.map(row => row.map(num => `||${num == 9 ? mineSweeperEmojis[`bomb`] : mineSweeperEmojis[num]}||`).join(``)).join(`\n`);
  field = (`**Mines: ${mineCount}** (Tip: Corners are never mines)\n${output}`);
  // we need to split it up because only 99 emoji per message limit for some reason.
  let degradingField = field;
  function countEmoji(text) {
    const emojiRegex = new RegExp(`(${Object.values(mineSweeperEmojis).map(emoji => emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(`|`)})`, 'g');
    const emoji = text.match(emojiRegex);
    return emoji?.length || 0;
  }
  if (countEmoji(field) <= 99) {
    return int.editReply(field); // No splitting needed
  }
  while (countEmoji(degradingField) > 99) {
    let segment = ``;
    while (countEmoji(segment + degradingField.substring(0, degradingField.indexOf(`\n`) >= 0 ? degradingField.indexOf(`\n`) : degradingField.length)) <= 99) {
      segment += degradingField.substring(0, (degradingField.indexOf(`\n`) >= 0 ? degradingField.indexOf(`\n`) : degradingField.length) + 1);
      degradingField = degradingField.substring((degradingField.indexOf(`\n`) >= 0 ? degradingField.indexOf(`\n`) : degradingField.length) + 1);
    }
    if (segment + degradingField == field) {
      await int.editReply(segment);
    } else {
      await int.channel.send(segment);
    }
  }
  return int.channel.send(degradingField);
}
/**
 * function slashFunRollOld
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollOld interaction
 * @returns {Promise<Discord.Message<boolean>>}
 */
async function slashFunRollOld(int) {
  let rollFormula = int.options.getString('rollformula');
  if (!rollFormula) rollFormula = `1d6`;
  rollFormula = rollFormula.toLowerCase().replace(/-/g, `+-`).replace(/ /g, ``);
  const diceExp = /(\d+)?d\d+(\+-?(\d+)?d?\d+)*/;
  const roughDice = diceExp.exec(rollFormula);
  const fateExp = /(\d+)?df(\+-?\d+)?/i;
  const fate = fateExp.exec(rollFormula);
  if (roughDice) {
    const exp = roughDice[0].replace(/\+-/g, `-`);
    const dice = roughDice[0].split(`+`);

    const doneRolls = [];
    let total = 0;

    dice.forEach((formula, rollCount) => {
      doneRolls[rollCount] = [];
      if (formula.includes(`d`)) {
        const add = (formula.startsWith(`-`) ? -1 : 1);
        if (add == -1) formula = formula.substr(1);
        if (formula.startsWith(`d`)) formula = `1${formula}`;
        const formulaParts = formula.split(`d`);
        const num = parseInt(formulaParts[0], 10);
        if (num && num <= 10000) {
          for (let i = 0; i < num; i++) {
            const val = Math.ceil(Math.random() * parseInt(formulaParts[1], 10)) * add;
            doneRolls[rollCount].push((i == 0 ? `**${formula}:** ` : ``) + val);
            total += val;
          }
        } else {
          return int.editReply(`I'm not going to roll *that* many dice... 🙄`);
        }
      } else {
        total += parseInt(formula, 10);
        rollCount[rollCount].push(`**${formula}**`);
      }
    });
    if (doneRolls.length > 0) {
      return int.editReply(`You rolled ${exp} and got:${total}\n` +
          ((doneRolls.reduce((a, c) => a + c.length, 0) > 20) ? `` : ` ( ${doneRolls.reduce((a, c) => a + c.join(`, `) + `; `, ``)})`));
    } else {
      return int.editReply(`you didn't give me anything to roll.`);
    }
  } else if (fate) {
    const exp = fate[0].replace(/\+-/g, `-`);
    const dice = fate[0].split(`+`);

    const rolls = [];
    dice.forEach(d => {
      if (d.includes(`df`)) {
        const add = (d.startsWith(`-`) ? -1 : 1);
        if (add == -1) d = d.substr(1);
        if (d.startsWith(`df`)) d = `1${d}`;
        const num = parseInt(d, 10);
        if (num && num <= 10000) {
          for (let i = 0; i < num; i++) {
            rolls.push((Math.floor(Math.random() * 3) - 1) * add);
          }
        } else {
          return int.editReply(`I'm not going to roll *that* many dice... 🙄`);
        }
      } else {
        rolls.push(parseInt(d, 10));
      }
    });
    if (rolls.length > 0) {
      return int.editReply(`You rolled ${exp} and got:${rolls.reduce((c, d) => c + d, 0)}\n` +
          ((rolls.length > 20) ? `` : ` (${rolls.join(`, `)})`));
    } else {
      return int.editReply(`you didn't give me anything to roll.`);
    }
  } else {
    return int.editReply(`that wasn't a valid dice expression.`);
  }
}
/**
 * function slashFunRollF
 * @param {Discord.ChatInputCommandInteraction} int a /fun rollF interaction
 * @returns {Promise<Discord.Message<boolean>>}
 */
async function slashFunRollF(int) {
  let dice = int.options.getInteger('dice');
  let modifier = int.options.getInteger('modifier');
  if (!dice) dice = 1;
  if (!modifier) modifier = 0;
  const rolls = [];
  const num = dice;
  if (num && num <= 10000) {
    for (let i = 0; i < num; i++) {
      rolls.push((Math.floor(Math.random() * 3) - 1));
    }
  } else {
    return int.editReply(`I'm not going to roll *that* many dice... 🙄`);
  }
  if (rolls.length > 0) {
    return int.editReply(`You rolled ${dice}df and got:${rolls.reduce((c, d) => c + d, 0)}\n` +
    ((rolls.length > 20) ? `` : ` (${rolls.join(`, `)})`));
  } else {
    return int.editReply(`you didn't give me anything to roll.`);
  }
}
/**
 * function slashFunRoll
 * @param {Discord.ChatInputCommandInteraction} int a /fun roll interaction
 * @returns {Promise<Discord.Message<boolean>>}
 */
async function slashFunRoll(int) {
  let dice = int.options.getInteger('dice');
  let sides = int.options.getInteger('sides');
  let modifier = int.options.getInteger('modifier');
  if (!dice) dice = 1;
  if (!sides) sides = 6;
  if (!modifier) modifier = 0;
  /** @type {string[][]} */
  const rolls = [];
  let total = 0;
  rolls[sides] = [];
  const num = dice;
  if (num && num <= 10000) {
    for (let i = 0; i < num; i++) {
      const val = Math.ceil(Math.random() * sides);
      rolls[sides].push((i == 0 ? `**d${sides}:** ` : ``) + val);
      total += val;
    }
  } else {
    return int.editReply(`I'm not going to roll *that* many dice... 🙄`);
  }
  if (modifier) {
    total += dice;
    rolls[sides].push(`**${dice}**`);
  }
  if (rolls.length > 0) {
    return int.editReply(`You rolled ${dice}d${sides} and got:${total}\n` +
        ((rolls.reduce((a, c) => a + c.length, 0) > 20) ? `` : ` ( ${rolls.reduce((a, c) => a + c.join(`, `) + `; `, ``)})`));
  } else {
    return int.editReply(`you didn't give me anything to roll.`);
  }
}
/**
 * function ball8
 * @param {Discord.ChatInputCommandInteraction} int a /fun 8ball interaction
 */
async function slashFun8ball(int) {
  const question = int.options.getString(`question`);
  if (!question || !question.endsWith(`?`)) {
    return int.editReply(`you need to ask me a question, silly.`);
  } else {
    const outcomes = [
      `It is certain.`,
      `It is decidedly so.`,
      `Without a doubt.`,
      `Yes - definitely.`,
      `You may rely on it.`,
      `As I see it, yes.`,
      `Most likely.`,
      `Outlook good.`,
      `Yes.`,
      `Signs point to yes.`,
      `Reply hazy, try again.`,
      `Ask again later.`,
      `Better not tell you now.`,
      `Cannot predict now.`,
      `Concentrate and ask again.`,
      `Don't count on it.`,
      `My reply is no.`,
      `My sources say no.`,
      `Outlook not so good.`,
      `Very doubtful.`
    ];
    return int.editReply(`You asked :"${question}"\n` +
      `The 8ball replies:\n` +
      u.rand(outcomes));
  }
}
/**
 * function repost
 * @param {Discord.ChatInputCommandInteraction} int a /fun repost interaction
 */
async function slashFunRepost(int) {
  if (!int.channel) {
    return int.editReply(`I don't know where here is, so I can't find anything to repost... try in a more normal channel.`);
  }
  const messages = (await int.channel.messages.fetch({ limit: 100 }));
  const filtered = messages.filter(m => m.attachments.size > 0);
  const latest = filtered.last();
  if (!latest) {
    return int.editReply(`I couldn't find anything in the last 100 messages to repost.`);
  }
  const latestsAttatchments = latest.attachments;
  if (!latestsAttatchments) {
    u.errorLog.send({ embeds: [ u.embed().setDescription(`impossible /repost error #1`)] });
    return int.editReply(`I'm going crazy, this error should be impossible.`);
  }
  const latestsFirstAttatchment = latestsAttatchments.first();
  if (!latestsFirstAttatchment) {
    u.errorLog.send({ embeds: [ u.embed().setDescription(`impossible /repost error #2`)] });
    return int.editReply(`I'm going crazy, this error should be impossible.`);
  }
  const imgToRepost = latestsFirstAttatchment.url;
  return int.editReply(imgToRepost);
}
/**
 * function buttermelon
 * @param {Discord.ChatInputCommandInteraction} int a /fun buttermelon interaction
 */
async function slashFunButtermelon(int) {
  const buttermelonFacts = require('../data/buttermelonFacts.json');
  return int.editReply(`🍌 ${u.rand(buttermelonFacts.facts)}`);
}
/**
 * function buttermelonEdit
 * @param {Discord.Message} msg a message potentially containing bannana(s)
 */
function buttermelonEdit(msg) {
  if ((msg.channel.id == u.sf.channels.botspam || msg.channel.id == u.sf.channels.bottesting) && (msg.cleanContent.toLowerCase() == `test`)) {
    msg.channel.send((Math.random() < 0.8 ? `pass` : `fail`));
  }
  const exclude = ['121033996439257092', '164784857296273408'];// IDK where these are so hardcoded they shall currently remain.
  const roll = Math.random();
  if (roll < 0.3 && !msg.author.bot && !exclude.includes(msg.channel.id)) {
    // let banana = /[bß8ƥɓϐβбБВЬЪвᴮᴯḃḅḇÞ][a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+([nⁿńňŋƞǹñϰпНhийӣӥѝνṅṇṉṋ]+[a@∆æàáâãäåāăȁȃȧɑαдӑӓᴀᴬᵃᵅᶏᶐḁạảấầẩẫậắằẳẵặ4Λ]+){2}/ig;
    if (msg.content.toLowerCase().includes(`bananas`)) {
      if (roll < 0.1) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonsMan.jpeg')] }).catch(u.errorHandler);
      } else {
        msg.channel.send(`*buttermelons`).catch(u.errorHandler);
      }
    } else if (msg.content.toLowerCase().includes(`banana`)) {
      if (roll < 0.06) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonPile.png')] }).catch(u.errorHandler);
      } else if (roll < 0.1) {
        msg.channel.send({ files: [new Discord.AttachmentBuilder('media/buttermelonMan.jpeg')] }).catch(u.errorHandler);
      } else {
        msg.channel.send(`*buttermelon`).catch(u.errorHandler);
      }
    }
  }
}
/**
 * function slashFunQuote
 * @param {Discord.ChatInputCommandInteraction} int a /fun quote interaction
 */
async function slashFunQuote(int) {
  const url = `https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en`;
  const response = await axios({ url, method: `get` }).catch((/** @type {axios.AxiosError} */ e) => {
    throw new Error(`quote command error:${e.status}`);
  });
  const data = response.data;
  if (data) {
    const randomQuote = data;
    return int.editReply(`> ${randomQuote.quoteText}\n> - ${randomQuote.quoteAuthor}`);
  } else {
    return int.editReply(`> A developer uses dark mode because bugs are attracted to light, \n` +
    `> but wouldn't that put the bugs in the code instead of the background?\n` +
    `> - ChainSword20000`);
  }
}
/**
 * function namegame
 * @param {Discord.ChatInputCommandInteraction} int a /fun namegame interaction
 */
async function slashFunNamegame(int) {
  let nameArg = int.options.getString(`name`);
  try {
    if (!nameArg) nameArg = int.user.displayName;
    nameArg = nameArg.replace(/[^a-zA-Z]/g, '_');// just ABCabc etc, numbers were causing problems.
    nameArg = nameArg.split(`_`)[0];// and just one segment
    const name = nameArg;
    const url = `https://thenamegame-generator.com/lyrics/${name}.html`;
    const response = await axios({ url, method: `get` }).catch((/** @type {axios.AxiosError} */ e) => {
      int.editReply(`Could not generate lyrics for ${name}.\nPerhaps you can get it yourself from https://thenamegame-generator.com.`);
      throw new Error(`namegame command error:${e.status}`);
    });
    const data = response.data;
    if (data) {
      const profanityFilter = require(`profanity-matcher`);
      const pf = new profanityFilter();
      const lyricsUntrimmedEnd = data.substring(data.indexOf(`<blockquote>`) + 12);
      const lyricsTrimmedWithHtml = lyricsUntrimmedEnd.substring(0, lyricsUntrimmedEnd.indexOf(`</blockquote>`));
      const results = lyricsTrimmedWithHtml.replace(/<br>/g, `\n`).replace(/<br \/>/g, `\n`);
      const pfresults = pf.scan(results.toLowerCase().replace(/[-\n]/g, ` `).replace(/\s\s+/g, ` `));
      const ispf = (pfresults.length > 0 && pfresults[0]) || (pfresults.length > 1);
      if (!ispf && (name.length <= 230) && (results.length + name.length <= 5750)) {
        const embed = u.embed().setTitle(`🎶 **The Name Game! ${name}! 🎵`).setDescription(results);
        int.editReply({ embeds:[embed] });
      } else {
        int.editReply(`😬`);
      }
    } else {
      int.editReply(`❌`);
    }
  } catch (error) { u.errorHandler(error, int); }
}


/**
 * function chaos
 * @param {Discord.CommandInteraction} int a /fun chaos interaction
 */
function slashFunChaos(int) {
  int.editReply({ content:int.user.displayName + ` right now:`, files: [new Discord.AttachmentBuilder('media/chaos.gif')] }).catch(u.errorHandler);
}
const Module = new Augur.Module()
.addInteraction({
  name: `fun`,
  id: u.sf.commands.slashFun,
  process: async (int) => {
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply(); // { ephemeral: true });
    switch (subcommand) {
      case `roll`: return slashFunRoll(int);
      case `rollf`: return slashFunRollF(int);
      case `rollold`: return slashFunRollOld(int);
      case `8ball`: return slashFun8ball(int);
      case `repost`: return slashFunRepost(int);
      case `mines`: return slashFunMinesweeper(int);
      case `acronym`: return slashFunAcronym(int);
      case `allthe`: return slashFunAllThe(int);
      case `hbs`: return slashFunHBS(int);
      case `color`: return slashFunColor(int);
      case `hug`: return slashFunHug(int);
      case `buttermelon`: return slashFunButtermelon(int);
      case `quote`: return slashFunQuote(int);
      case `namegame`: return slashFunNamegame(int);
      case `chaos`: return slashFunChaos(int);
      default:
        u.errorLog.send({ embeds: [ u.embed().setDescription(`Error, command ${int} isn't associated with anything in fun.js`)] });
        return int.editReply(`Thats an error, this command isn't registered properly. I've let my devs know.`);
    }
  },
})
.addEvent(`message`, buttermelonEdit)
.addEvent(`messageUpdate`, (oldMsg, msg) => {
  if (oldMsg.partial || !(oldMsg.cleanContent.toLowerCase().includes(`banana`))) {
    buttermelonEdit(msg);
  }
// })
// .addEvent(
//   `messageReactionAdd`,
//   (reaction) => { // could have (reaction, user) as args but lint don't like unused var.
//     if ((reaction.message.channel.id == u.sf.channels.memes) && (reaction.emoji.name == `♻️`)) { //memes channel id will have to be added if this is to be enabled.
//       reaction.remove();
//       reaction.message.react(`⭐`).catch(u.errorHandler);
//     }
});

module.exports = Module;