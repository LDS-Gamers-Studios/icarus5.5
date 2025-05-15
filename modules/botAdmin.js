// @ts-check
// This file is a place for all the publicly visible bot diagnostic commands usable primarily only by the head bot dev.

const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  fs = require("fs"),
  path = require("path"),
  u = require("../utils/utils");

/**
 * function fieldMismatches
 * @param {Record<string, any>} obj1 First object for comparison
 * @param {Record<string, any>} obj2 Second object for comparison
 * @returns {[string[], string[]]} Two-element array. The first contains keys found in first object but not the second. The second contains keys found in the second object but not the first.
 */
function fieldMismatches(obj1, obj2) {
  const keys1 = new Set(Object.keys(obj1));
  const keys2 = new Set(Object.keys(obj2));

  /** @type {string[]} */
  const m1 = [];
  /** @type {string[]} */
  const m2 = [];
  for (const key of keys1) {
    if (keys2.has(key)) {
      if (obj1[key] !== null && !Array.isArray(obj1[key]) && typeof obj1[key] === "object") {
        const [m_1, m_2] = fieldMismatches(obj1[key], obj2[key]);
        for (const m of m_1) {
          m1.push(key + "." + m);
        }
        for (const m of m_2) {
          m2.push(key + "." + m);
        }
      }
      keys2.delete(key);
    } else {
      m1.push(key);
    }
  }
  for (const key of keys2) {
    if (keys1.has(key)) {
      if (obj1[key] !== null && typeof obj1[key] === "object") {
        const [m_1, m_2] = fieldMismatches(obj1[key], obj2[key]);
        for (const m of m_1) {
          m1.push(key + "." + m);
        }
        for (const m of m_2) {
          m2.push(key + "." + m);
        }
      }
    } else {
      m2.push(key);
    }
  }

  return [m1, m2];
}

let warned = false;

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotGtb(int) {
  try {
    // prevent double cakedays if possible
    if (!warned && u.moment().hours() === 15) {
      await int.editReply("It's cakeday and birthday hour! If you really need to restart, run this again.");

      warned = true;
      return setTimeout(() => {
        warned = false;
      }, 5 * 60_000);
    }
    await int.editReply("Good night! 🛏");
    await int.client.destroy();
    process.exit();
  } catch (error) {
    u.errorHandler(error, int);
  }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {Discord.InteractionResponse} msg
 */
async function slashBotPing(int, msg) {
  const sent = await int.editReply("Pinging...");
  return int.editReply(`Pong! Took ${sent.createdTimestamp - msg.createdTimestamp}ms`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotPull(int) {
  const spawn = require("child_process").spawn;
  const cmd = spawn("git", ["pull"], { cwd: process.cwd() });
  /** @type {string[]} */
  const stdout = [];
  /** @type {string[]} */
  const stderr = [];
  cmd.stdout.on("data", data => {
    stdout.push(data);
  });

  cmd.stderr.on("data", data => {
    stderr.push(data);
  });

  cmd.on("close", code => {
    if (code === 0) {
      int.editReply(stdout.join("\n") + "\n\nCompleted with code: " + code);
    } else {
      int.editReply(`ERROR CODE ${code}:\n${stderr.join("\n")}`);
    }
  });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotPulse(int) {
  const client = int.client;
  const uptime = process.uptime();

  const embed = u.embed()
    .setAuthor({ name: client.user.username + " Heartbeat", iconURL: client.user.displayAvatarURL() })
    .setTimestamp()
    .addFields([
      { name: "Uptime", value: `Discord: ${Math.floor(client.uptime / (24 * 60 * 60 * 1000))} days, ${Math.floor(client.uptime / (60 * 60 * 1000)) % 24} hours, ${Math.floor(client.uptime / (60 * 1000)) % 60} minutes\nProcess: ${Math.floor(uptime / (24 * 60 * 60))} days, ${Math.floor(uptime / (60 * 60)) % 24} hours, ${Math.floor(uptime / (60)) % 60} minutes`, inline: true },
      { name: "Reach", value: `${client.guilds.cache.size} Servers\n${client.channels.cache.size} Channels\n${client.users.cache.size} Users`, inline: true },
      { name: "Commands Used", value: `${client.moduleManager.commands.commandCount} (${(client.moduleManager.commands.commandCount / (client.uptime / (60 * 1000))).toFixed(2)}/min)`, inline: true },
      { name: "Memory", value: `${Math.round(process.memoryUsage().rss / 1024 / 1000)}MB`, inline: true }
    ]);
  return int.editReply({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotReload(int) {
  let files = int.options.getString("module")?.split(" ") ?? [];

  if (!files) files = fs.readdirSync(path.resolve(__dirname)).filter(file => file.endsWith(".js"));

  for (const file of files) {
    try {
      int.client.moduleManager.reload(path.resolve(__dirname, file));
    } catch (error) { return u.errorHandler(error, int); }
  }
  return int.editReply("Reloaded!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotSheets(int) {
  const sheet = int.options.getString("sheet-name") || undefined;
  if (sheet && !Object.keys(u.db.sheets).includes(sheet)) return int.editReply("That's not one of the sheets I can refresh.");
  // @ts-expect-error
  await u.db.sheets.loadData(int.client, true, true, sheet);
  return int.editReply(`The ${sheet ? `${sheet} sheet has` : "sheets have"} been reloaded!`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotGetId(int) {
  const mentionable = int.options.getMentionable("mentionable");
  const channel = int.options.getChannel("channel");
  const emoji = int.options.getString("emoji");

  /** @type {{ str: string, id: string }[]} */
  const results = [];
  if (mentionable) results.push({ str: mentionable.toString(), id: mentionable.id });
  if (channel) results.push({ str: channel.toString(), id: channel.id });
  if (emoji) {
    const emojis = emoji.split(" ");
    for (const e of emojis) results.push({ str: e, id: `\\${e}` });
  }
  return int.editReply(`I got the following results:\n${results.map(r => `${r.str}: ${r.id}`).join("\n")}`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotRegister(int) {
  const spawn = require("child_process").spawn;
  const cmd = spawn("node", ["register-commands"], { cwd: process.cwd() });
  /** @type {string[]} */
  const stderr = [];
  cmd.stderr.on("data", data => {
    stderr.push(data);
  });
  cmd.on("close", code => {
    if (code === 0) {
      int.editReply("Commands registered! Restart the bot to finish.");
    } else {
      int.editReply(`ERROR CODE ${code}:\n${stderr.join("\n")}`);
    }
  });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int*/
async function slashBotStatus(int) {
  const stat = int.options.getString("status");
  if (stat) {
    // yes, i want to use an array. no, tscheck wont let me
    if (stat === 'online' || stat === "idle" || stat === "invisible" || stat === "dnd") int.client.user.setActivity(stat);
  }
  const name = int.options.getString("activity", false);
  if (!name && !stat) {
    int.client.user.setActivity();
    return int.editReply("Status reset");
  }
  if (name) {
    const t = int.options.getString("type");
    // @ts-ignore
    const type = t ? Discord.ActivityType[t] : undefined;
    const url = int.options.getString("url") ?? undefined;
    int.client.user.setActivity({ name, type, url });
    return int.editReply(`Status set to ${t ?? ""} ${name}`);
  }
  return int.editReply("Status updated!");
}

const Module = new Augur.Module()
.addInteraction({
  name: "bot",
  id: u.sf.commands.slashBot,
  onlyGuild: true,
  hidden: true,
  options: { registry: "slashBot" },
  permissions: (int) => u.perms.calc(int.member, ["botTeam", "botAdmin"]),
  process: async (int) => {
    if (!u.perms.calc(int.member, ["botTeam", "botAdmin"])) return; // redundant check, but just in case lol
    const subcommand = int.options.getSubcommand(true);
    const forThePing = await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.botTesting) });
    if (["gotobed", "reload", "register", "status", "sheets"].includes(subcommand) && !u.perms.calc(int.member, ["botAdmin"])) return int.editReply("That command is only for Bot Admins.");
    if (subcommand === "pull" && !u.perms.isOwner(int.member)) return int.editReply("That command is only for the Bot Owner.");
    switch (subcommand) {
      case "gotobed": return slashBotGtb(int);
      case "ping": return slashBotPing(int, forThePing);
      case "pull": return slashBotPull(int);
      case "pulse": return slashBotPulse(int);
      case "reload": return slashBotReload(int);
      case "getid": return slashBotGetId(int);
      case "register": return slashBotRegister(int);
      case "status": return slashBotStatus(int);
      case "sheets": return slashBotSheets(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused();
    const files = fs.readdirSync(path.resolve(__dirname)).filter(file => file.endsWith(".js"));
    int.respond(files.filter(file => file.includes(option)).slice(0, 24).map(f => ({ name: f, value: f })));
  }
})
.addInteraction({
  id: u.sf.commands.messageEditMessage,
  name: "Edit",
  type: "ContextMessage",
  onlyGuild: true,
  permissions: (int) => u.perms.calc(int.member, ["mgr"]),
  process: async (int) => {
    const msg = await int.targetMessage.fetch().catch(u.noop);
    if (!msg) return int.reply({ content: "Sorry, I couldn't find the message.", flags: ["Ephemeral"] });
    if (msg.author.id !== int.client.user.id || !msg.editable) return int.reply({ content: "Sorry, I can't edit that message.", flags: ["Ephemeral"] });

    const modal = new u.Modal()
      .addComponents(
        u.ModalActionRow()
          .setComponents(
            new u.TextInput()
              .setCustomId("content")
              .setLabel("Message Content (leave blank to delete)")
              .setValue(msg.content)
              .setPlaceholder("Leave blank to delete")
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(4000)
              .setRequired(false)
          )
      )
      .setTitle("Message Edit/Delete")
      .setCustomId(`sme${int.id}`);

    await int.showModal(modal);
    const res = await int.awaitModalSubmit({ time: 5 * 60_000, dispose: true }).catch(u.noop);
    if (!res) return await int.editReply("I fell asleep waiting for your input...");

    const content = res.fields.getTextInputValue("content");
    await res.deferReply({ flags: ["Ephemeral"] });

    if (!content) {
      const del = await msg.delete().catch(u.noop);
      if (!del) return res.editReply("Sorry, I couldn't delete the message.");
      return res.editReply("Message deleted!");
    }

    const edit = await msg.edit({ content }).catch(u.noop);
    if (!edit) return res.editReply("Sorry, I couldn't edit the message.");

    return res.editReply("Message edited!");
  }
})
.addCommand({ name: "mcweb",
  hidden: true,
  permissions: () => config.devMode,
  process: (msg, suffix) => {
    if (!config.webhooks.mcTesting) return msg.reply("Make sure to set a webhook for mcTestingWebhook! You need it to run this command.");
    const webhook = new Discord.WebhookClient({ url: config.webhooks.mcTesting });
    webhook.send(suffix);
  }
})

// When the bot is fully online, fetch all the ldsg members, since it will only autofetch for small servers and we want them all.
.addEvent("ready", () => {
  Module.client.guilds.cache.get(u.sf.ldsg)?.members.fetch({ withPresences: true });
})
.setInit(async (reloaded) => {
  try {
    if (!reloaded && !config.silentMode) {
      u.errorLog.send({ embeds: [ u.embed().setDescription("Bot is ready!") ] });
    }
    const testingDeploy = [
      ["../config/config.json", "../config/config-example.json"],
      ["../config/snowflakes-testing.json", "../config/snowflakes.json"],
      ["../config/snowflakes-commands.json", "../config/snowflakes-commands-example.json"],
      ["../data/banned.json", "../data/banned-example.json"]
    ];
    for (const filename of testingDeploy) {
      const prod = require(filename[1]);
      const repo = require(filename[0]);
      const [m1, m2] = fieldMismatches(prod, repo);
      if (m1.length > 0 && !config.silentMode) {
        u.errorLog.send({ embeds: [
          u.embed()
          .addFields({ name: "Config file and example do not match.", value: `Field(s) \`${m1.join("`, `")}\` in file ${filename[1]} but not ${filename[0]} file.` })
        ] });
      }
      if (m2.length > 0 && !config.silentMode) {
        u.errorLog.send({ embeds: [
          u.embed()
          .addFields({ name: "Config file and example do not match.", value: `Field(s) \`${m2.join("`, `")}\` in ${filename[0]} file but not ${filename[1]}` })
        ] });
      }
    }
  } catch (e) {
    u.errorHandler(e, "Error in botAdmin.setInit.");
  }
})
.setUnload(() => true);

module.exports = Module;

