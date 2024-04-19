// This file is a place for all the publicly visible bot diagnostic commands usable primarily only by the head bot dev.

const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  config = require("../config/config.json"),
  p = require("../utils/perms"),
  u = require("../utils/utils");

/**
 * function fieldMismatches
 * @param {Object} obj1 First object for comparison
 * @param {Object} obj2 Second object for comparison
 * @returns String[] Two-element array. The first contains keys found in first object but not the second. The second contains keys found in the second object but not the first.
 */
function fieldMismatches(obj1, obj2) {
  const keys1 = new Set(Object.keys(obj1));
  const keys2 = new Set(Object.keys(obj2));

  const m1 = [];
  const m2 = [];
  for (const key of keys1) {
    if (keys2.has(key)) {
      if (obj1[key] != null && !Array.isArray(obj1[key]) && typeof obj1[key] === "object") {
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
      if (obj1[key] != null && typeof obj1[key] === "object") {
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

const Module = new Augur.Module()
.addCommand({ name: "gotobed",
  description: "The gotobed command shuts down the bot. This is good for a quick test for things !reload doesn't cover.", // It is reccomended to be used in conjunction with forever.js so the bot automatically restarts
  category: "Bot Admin",
  hidden: true,
  aliases: ["q", "restart"],
  permissions: p.isAdmin,
  process: async function(msg) {
    try {
      await msg.react("🛏");
      await msg.client.destroy();
      process.exit();
    } catch (e) { u.errorHandler(e, msg); }
  }
})
.addCommand({ name: "ping",
  category: "Bot Admin",
  description: "Gets the current total ping time for the bot.",
  hidden: true,
  permissions: (msg) => p.isOwner(msg) || p.isMod(msg) || p.isTeam(msg),
  process: async (msg) => {
    const sent = await msg.reply({ content: 'Pinging...', allowedMentions: { repliedUser: false } });
    sent.edit({ content: `Pong! Took ${sent.createdTimestamp - (msg.editedTimestamp ? msg.editedTimestamp : msg.createdTimestamp)}ms`, allowedMentions: { repliedUser: false } });
  }
})
.addCommand({ name: "pull",
  category: "Bot Admin",
  description: "Pull bot updates from git",
  hidden: true,
  permissions: p.isOwner,
  process: (msg) => {
    const spawn = require("child_process").spawn;

    u.clean(msg);

    const cmd = spawn("git", ["pull"], { cwd: process.cwd() });
    const stdout = [];
    const stderr = [];

    cmd.stdout.on("data", data => {
      stdout.push(data);
    });

    cmd.stderr.on("data", data => {
      stderr.push(data);
    });

    cmd.on("close", code => {
      if (code == 0) {
        msg.channel.send(stdout.join("\n") + "\n\nCompleted with code: " + code).then(u.clean);
      } else {
        msg.channel.send(`ERROR CODE ${code}:\n${stderr.join("\n")}`).then(u.clean);
      }
    });
  }
})
.addCommand({ name: "pulse",
  category: "Bot Admin",
  hidden: true,
  description: "The pulse command get basic information about the bot's current health and uptime for each shard (if applicable).",
  permissions: p.isOwner,
  process: async function(msg) {
    try {
      const client = msg.client;

      const embed = u.embed()
      .setAuthor({ name: client.user.username + " Heartbeat", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

      if (client.shard) {
        let guilds = await client.shard.fetchClientValues('guilds.cache.size');
        guilds = guilds.reduce((prev, val) => prev + val, 0);
        let channels = client.shard.fetchClientValues('channels.cache.size');
        channels = channels.reduce((prev, val) => prev + val, 0);
        let mem = client.shard.broadcastEval("Math.round(process.memoryUsage().rss / 1024 / 1000)");
        mem = mem.reduce((t, c) => t + c);
        embed
        .addFields(
          { name: "Shards", value: `Id: ${client.shard.id}\n(${client.shard.count} total)`, inline: true },
          { name: "Total Bot Reach", value: `${guilds} Servers\n${channels} Channels`, inline: true },
          { name: "Shard Uptime", value: `${Math.floor(client.uptime / (24 * 60 * 60 * 1000))} days, ${Math.floor(client.uptime / (60 * 60 * 1000)) % 24} hours, ${Math.floor(client.uptime / (60 * 1000)) % 60} minutes`, inline: true },
          { name: "Shard Commands Used", value: `${client.commands.commandCount} (${(client.commands.commandCount / (client.uptime / (60 * 1000))).toFixed(2)}/min)`, inline: true },
          { name: "Total Memory", value: `${mem}MB`, inline: true }
        );

        msg.channel.send({ embeds: [embed] });
      } else {
        const uptime = process.uptime();
        embed
        .addFields(
          { name: "Uptime", value: `Discord: ${Math.floor(client.uptime / (24 * 60 * 60 * 1000))} days, ${Math.floor(client.uptime / (60 * 60 * 1000)) % 24} hours, ${Math.floor(client.uptime / (60 * 1000)) % 60} minutes\nProcess: ${Math.floor(uptime / (24 * 60 * 60))} days, ${Math.floor(uptime / (60 * 60)) % 24} hours, ${Math.floor(uptime / (60)) % 60} minutes`, inline: true },
          { name: "Reach", value: `${client.guilds.cache.size} Servers\n${client.channels.cache.size} Channels\n${client.users.cache.size} Users`, inline: true },
          { name: "Commands Used", value: `${client.commands.commandCount} (${(client.commands.commandCount / (client.uptime / (60 * 1000))).toFixed(2)}/min)`, inline: true },
          { name: "Memory", value: `${Math.round(process.memoryUsage().rss / 1024 / 1000)}MB`, inline: true }
        );

        msg.channel.send({ embeds: [embed] });
      }
    } catch (e) { u.errorHandler(e, msg); }
  }
})
.addCommand({ name: "reload",
  category: "Bot Admin",
  hidden: true,
  syntax: "[file1.js] [file2.js]",
  description: "This command reloads one or more modules. Good for loading in small fixes.",
  info: "Use the command without a suffix to reload all command files.\n\nUse the command with the module name (including the `.js`) to reload a specific file.",
  parseParams: true,
  permissions: p.isAdmin,
  process: (msg, ...files) => {
    u.clean(msg);
    const fs = require("fs"),
      path = require("path");
    if (files.length === 0) files = fs.readdirSync(path.resolve(__dirname)).filter(file => file.endsWith(".js"));

    for (const file of files) {
      try {
        msg.client.moduleHandler.reload(path.resolve(__dirname, file));
      } catch (error) { msg.client.errorHandler(error, msg); }
    }
    msg.react("👌").catch(u.noop);
  }
})
.addCommand({ name: "emojiid",
  description: "Get an emoji ID",
  syntax: "<emoji name>",
  category: "Admin",
  hidden: true,
  permissions: (msg) => msg.guild,
  process: (msg, suffix) => {
    if (!suffix) {
      msg.reply("you need to tell me an emoji name!").then(u.clean);
    } else {
      const emoji = msg.guild.emojis.cache.find(r => r.name.toLowerCase() == suffix.toLowerCase());
      if (!emoji) msg.reply(`I couldn't find an emoji named ${suffix}.`);
      else msg.channel.send(`${emoji} \`${emoji.name}: ${emoji.id}\``);
    }
  }
})
.addCommand({ name: "roleid",
  description: "Get a role ID",
  syntax: "<role name>",
  category: "Admin",
  hidden: true,
  permissions: (msg) => msg.guild,
  process: (msg, suffix) => {
    if (!suffix) {
      msg.reply("you need to tell me a role name!").then(u.clean);
    } else {
      const role = msg.guild.roles.cache.find(r => r.name.toLowerCase() == suffix.toLowerCase());
      if (!role) msg.reply(`I couldn't find a role named ${suffix}.`);
      else msg.channel.send(`${role.name}: ${role.id}`);
    }
  }
})
.addCommand({ name: "mcweb",
  permissions: () => config.devMode,
  process: (msg, suffix) => {
    if (!config.mcTestingWebhook) return msg.reply("Make sure to set a webhook for mcTestingWebhook! You need it to run this command.");
    const webhook = new Discord.WebhookClient({ url: config.mcTestingWebhook });
    webhook.send(suffix);
  }
})
// When the bot is fully online, fetch all the ldsg members, since it will only autofetch for small servers and we want them all.
.addEvent("ready", () => {
  Module.client.guilds.cache.get(u.sf.ldsg).members.fetch();
})
.setInit(async (reload) => {
  try {
    if (!reload && !config.silentMode) {
      u.errorLog.send({ embeds: [ u.embed().setDescription("Bot is ready!") ] });
    }
    const testingDeploy = [
      ["../config/config.json", "../config/config-example.json"],
      ["../config/rankConfig-testing.json", "../config/rankConfig.json"],
      ["../config/snowflakes-testing.json", "../config/snowflakes.json"],
      ["../config/snowflakes-testing-commands.json", "../config/snowflakes-testing-commands-example.json"],
      ["../data/banned.json", "../data/banned-example.json"]
    ];
    for (const filename of testingDeploy) {
      const prod = require(filename[1]);
      const repo = require(filename[0]);
      // console.log(`Checking ${filename}`);
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
