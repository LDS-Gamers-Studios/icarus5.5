/* eslint-disable no-console */
// @ts-check
const config = require("./config/config.json"),
  path = require("path"),
  fs = require("fs"),
  Discord = require("discord.js"),
  axios = require("axios");

/** @type {string} */
const ldsg = require(`./config/snowflakes${config.devMode ? "-testing" : ""}.json`).ldsg;

/************************
 * BEGIN "CONFIG" BLOCK *
 ************************/

const globalCommandFiles = [
  "messageBookmark.js",
  "slashAvatar.js",
  "slashFun.js",
  "slashHelp.js"
];

const guildCommandFiles = [
  "messageMod.js",
  "messageEdit.js",
  "slashBank.js",
  "slashBot.js",
  "slashClockwork.js",
  "slashGame.js",
  "slashGospel.js",
  "slashIgn.js",
  "slashLdsg.js",
  "slashManagement.js",
  "slashManager.js",
  "slashMissionary.js",
  "slashMod.js",
  "slashRank.js",
  "slashRole.js",
  "slashTag.js",
  "slashTeam.js",
  "slashTournaments.js",
  "slashUser.js",
  "slashVoice.js",
  "userMod.js"
];

/**********************
 * END "CONFIG" BLOCK *
 **********************/

/**
 * @typedef RegisteredCommand
 * @prop {number} type
 * @prop {string} id
 * @prop {string} name
 */

/**
 * @typedef {Discord.RESTPostAPIChatInputApplicationCommandsJSONBody | Discord.RESTPostAPIContextMenuApplicationCommandsJSONBody} RegFile
 */

/** @param {number} typeId */
function getCommandType(typeId) {
  switch (typeId) {
    case 1: return "slash";
    case 2: return "user";
    case 3: return "message";
    default: return typeId;
  }
}

/** @param {axios.AxiosError} error */
function displayError(error) {
  if (error.response) {
    if (error.response.status === 429) {
      console.log("You're being rate limited! try again after " + error.response.data.retry_after + " seconds. Starting countdown...");
      setTimeout(() => {
        console.log("try now!");
        process.exit();
      }, error.response.data.retry_after * 1000);
    } else if (error.response.status === 400) {
      console.log("You've got a bad bit of code somewhere! Unfortunately it won't tell me where :(");
    } else if (error.response.status === 401) {
      console.log("It says you're unauthorized...");
    } else {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    }
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log('Error', error.message);
    console.trace(error);
  }
  process.exit();
}

/**
 * @param {string[]} filepaths
 * @param {boolean} global
 */
async function patch(filepaths, global) {
  const commandPath = path.resolve(require.main ? path.dirname(require.main.filename) : process.cwd(), "./registry");

  /** @type {RegFile[]} */
  const data = [];
  for (const file of filepaths) {
    /** @type {RegFile} */
    const load = require(path.resolve(commandPath, file));
    data.push(load);
  }

  /** @type {{ data: RegisteredCommand[] } | void} */
  // @ts-expect-error
  const registered = await axios({
    method: "put",
    url: `https://discord.com/api/v8/applications/${config.applicationId}${global ? "" : `/guilds/${ldsg}`}/commands`,
    headers: { Authorization: `Bot ${config.token}` },
    data
  }).catch(displayError);

  if (registered) {
    console.log(`\n=====${global ? "Global" : "Guild"} commands registered=====`);
    const cmds = registered.data;
    console.log(cmds.map(c => {
      const commandType = getCommandType(c.type);
      return `${c.name} (${commandType}): ${c.id}`;
    }).join("\n"));
  }

  return registered?.data;
}

async function register() {
  const applicationId = config.applicationId;
  if (!applicationId) return console.log("Please put your application ID in config/config.json\nYou can find the ID here:\nhttps://discord.com/developers/applications");

  const guild = await patch(guildCommandFiles, false) ?? [];
  const global = await patch(globalCommandFiles, true) ?? [];

  /** @type {Record<string, string>} */
  const commands = Object.fromEntries(
    global.concat(guild)
      // turn into camel case
      .map(cmd => {
        const name = cmd.name.split(" ")
          .map(n => n[0].toUpperCase() + n.slice(1).toLowerCase())
          .join("");
        return [`${getCommandType(cmd.type)}${name}`, cmd.id];
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  );

  fs.writeFileSync(path.resolve(__dirname, "./config/snowflakes-commands.json"), JSON.stringify({ commands }, null, 2));

  // write new example file commands only if there are new ones
  // this prevents weirdness with git
  const oldExample = require("./config/snowflakes-commands-example.json");
  const oldKeys = Object.keys(oldExample.commands);
  const newKeys = Object.keys(commands);
  const diff = oldKeys.filter(c => !newKeys.includes(c)).concat(newKeys.filter(c => !oldKeys.includes(c)));

  if (diff.length > 0) fs.writeFileSync(path.resolve(__dirname, "./config/snowflakes-commands-example.json"), JSON.stringify({ commands: Object.fromEntries(newKeys.map(f => [f, ""])) }, null, 2));

  console.log("\nCommand snowflake files updated\n");
  process.exit();
}

register();