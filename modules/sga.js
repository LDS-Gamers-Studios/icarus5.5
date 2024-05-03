// @ts-check
const Augur = require("augurbot-ts"),
  u = require('../utils/utils'),
  Discord = require("discord.js");

const dict = {
  "ᔑ": "a",
  "ʖ": "b",
  "ᓵ": "c",
  "↸": "d",
  "ŀ": "e",
  "⎓": "f",
  "ㅓ": "g",
  "〒": "h",
  "╎": "i",
  "፧": "j",
  "ꖌ": "k",
  "ꖎ": "l",
  "ᒲ": "m",
  "リ": "n",
  "フ": "o",
  "¡": "p",
  "ᑑ": "q",
  "።": "r",
  "ነ": "s",
  "ﬧ": "t",
  "⚍": "u",
  "⍊": "v",
  "∴": "w",
  "∕": "x",
  "॥": "y",
  "∩": "z",
  "zeroWidthSpace": "​"
};

/** @param {String} sga */
function translate(sga) {
  let to = "";

  let upper = false;

  for (let i = 0; i < sga.length; i++) {
    const c = sga.charAt(i);
    if (c === dict.zeroWidthSpace) {
      upper = true;
      continue;
    }

    const f = dict[c];
    to += f ? (upper ? f.toUpperCase() : f) : c;
    upper = false;
  }

  return to;
}

/** @param {Discord.Message} msg */
async function handleMessage(msg) {
  if (msg.author.bot || !([...msg.content].some(char => Object.keys(dict).includes(char)))) {
    return;
  }

  const row = u.MessageActionRow()
  .addComponents(
    new u.Button()
      .setCustomId('sgaTranslate')
      .setLabel('Translate')
      .setStyle(Discord.ButtonStyle.Primary),
  );

  return await msg.reply({
    components: [row]
  });
}

/** @param {Discord.ButtonInteraction} inter */
async function handleButton(inter) {
  try {
    const message = await inter.message.fetchReference();
    const translated = translate(message.content);
    return inter.reply({ content: translated, ephemeral: true });
  } catch (e) {
    return inter.reply({ content: "It appears the message was deleted.", ephemeral: true });
  }
}

const Module = new Augur.Module()
  .addEvent("messageCreate", handleMessage)
  .addInteraction({
    id: "sgaTranslate",
    type: "Button",
    process: handleButton
  });

module.exports = Module;