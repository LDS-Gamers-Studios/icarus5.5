// @ts-check
const Augur = require("augurbot-ts");
const { OpenAI } = require("openai");
const fs = require("fs");
const u = require("../utils/utils");

const Module = new Augur.Module();

/**
 * Interface for generating AI messages
 * @param {string} rules
 * @param {string} [inputPart]
 */
function genMessage(rules, inputPart) {
  /** @type {OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming} */
  const model = {
    model: "gpt-4o-mini",
    store: true,
    temperature: 0.5,
    max_completion_tokens: 300,
    messages: [{ role: "developer", content: rules }]
  };

  if (inputPart) model.messages.push({ role: "user", content: inputPart });
  return model;
}

if (fs.existsSync("config/ai-.json")) {
  // @ts-ignore
  const aiConfig = require("../config/ai-.json");
  const api = new OpenAI({ apiKey: aiConfig.auth });

  const testRegex = /^(hey|hi|yo) (icarus|bird ?bot)/i;

  /** @type {Map<string, number>} */
  const cooldowns = new Map();

  Module.addEvent("messageCreate", async (msg) => {
    if (!msg.inGuild() || msg.author.bot) return;
    if (!testRegex.test(msg.content) && !msg.mentions.users.has(msg.client.user.id)) return;

    const cooldown = cooldowns.get(msg.author.id);
    if (cooldown) {
      return msg.reply(`You're on cooldown! Try in ${Math.floor((cooldown - Date.now()) / 1000)} seconds`)
        .then(u.clean)
        .catch(u.noop);
    }

    const coolDuration = 60_000;
    cooldowns.set(msg.author.id, new Date().valueOf() + coolDuration);

    setTimeout(() => {
      cooldowns.delete(msg.author.id);
    }, coolDuration);

    const rules = [
      "You are a very snarky and silly robot phoenix named Icarus",
      "No swearing",
      "You can lie and make up info",
      "Keep responses to the length of a text message",
      // "Talk like Spamton from Deltarune"
    ].join(". ") + ".";

    const name = msg.member?.displayName ?? msg.author.displayName;
    const prompt = `${name}: ${msg.content.substring(0, 150)}`;

    const params = genMessage(rules, prompt);
    const completion = await api.chat.completions.create(params).catch(u.noop);

    return msg.reply(completion?.choices[0]?.message.content || "idk man");
  });
}


module.exports = Module;