// @ts-check
const Augur = require("augurbot-ts"),
  u = require('../utils/utils'),
  Discord = require("discord.js");

const dict = new u.Collection([
  ["ᔑ", "a"],
  ["ʖ", "b"],
  ["ᓵ", "c"],
  ["↸", "d"],
  ["ŀ", "e"],
  ["⎓", "f"],
  ["ㅓ", "g"],
  ["〒", "h"],
  ["╎", "i"],
  ["፧", "j"],
  ["ꖌ", "k"],
  ["ꖎ", "l"],
  ["ᒲ", "m"],
  ["リ", "n"],
  ["フ", "o"],
  ["¡", "p"],
  ["ᑑ", "q"],
  ["።", "r"],
  ["ነ", "s"],
  ["ﬧ", "t"],
  ["⚍", "u"],
  ["⍊", "v"],
  ["∴", "w"],
  ["∕", "x"],
  ["॥", "y"],
  ["∩", "z"],
]);
const zeroWidthSpace = "​";

/** @param {String} sga */
function translate(sga) {
  let to = "";

  let upper = false;

  for (const char of sga) {
    const f = dict.get(char);
    if (char === zeroWidthSpace) {
      upper = true;
      continue;
    }

    to += f ? (upper ? f.toUpperCase() : f) : char;
    upper = false;
  }

  return to;
}

/** @param {Discord.Message} msg */
async function handleMessage(msg) {
  if (msg.author.bot || !dict.hasAny(...msg.content)) {
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
    const msg = await inter.message.fetchReference();
    const translated = translate(msg.content);
    return inter.reply({ content: translated, flags: ["Ephemeral"] });
  } catch (e) {
    return inter.reply({ content: "I couldn't find that message! Sorry.", flags: ["Ephemeral"] });
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