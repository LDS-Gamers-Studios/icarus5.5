// @ts-check
const config = require("./config/config.json"),
  u = require("./utils/utils"),
  path = require("path"),
  fs = require("fs"),
  axios = require("axios");

/************************
 * BEGIN "CONFIG" BLOCK *
 ************************/
const globalCommandFiles = [
  "messageBookmark.js",
  "slashAvatar.js"
];

const guildCommandFiles = [
  "messageMod.js",
  "slashBank.js",
  "slashBot.js",
  "slashGospel.js",
  "slashLdsg.js",
  "slashRank.js",
  "slashManagement.js",
  "slashMod.js",
  "slashUser.js",
  "slashTournament.js",
  "slashVoice.js",
  "userMod.js"
];

if (!config.devMode) guildCommandFiles.push("slashBotHidden-.js"); // secret commands >:)

/**********************
 * END "CONFIG" BLOCK *
 **********************/

/**
 * @typedef ReturnedCommand
 * @prop {{type: number, id: string, name: string}[]} data
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
    if (error.response.status == 429) {
      console.log("You're being rate limited! try again after " + error.response.data.retry_after + " seconds. Starting countdown...");
      setTimeout(() => {
        console.log("try now!");
        process.exit();
      }, error.response.data.retry_after * 1000);
    } else if (error.response.status == 400) {
      console.log("You've got a bad bit of code somewhere! Unfortunately it won't tell me where :(");
    } else if (error.response.status == 401) {
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
  }
  process.exit();
}

async function register() {
  const applicationId = config.applicationId;
  if (!applicationId) return console.log("Please put your application ID in config/config.json\nYou can find the ID here:\nhttps://discord.com/developers/applications");
  const commandPath = path.resolve(require.main ? path.dirname(require.main.filename) : process.cwd(), "./registry");

  const guildCommandLoads = [];
  for (const command of guildCommandFiles) {
    const load = require(path.resolve(commandPath, command));
    guildCommandLoads.push(load);
  }
  // @ts-expect-error
  const guild = await axios({
    method: "put",
    url: `https://discord.com/api/v8/applications/${applicationId}/guilds/${u.sf.ldsg}/commands`,
    headers: { Authorization: `Bot ${config.token}` },
    data: guildCommandLoads
  }).catch(displayError);
  if (guild) {
    console.log("=====Guild commands registered=====");
    const cmds = guild.data;
    for (const c of cmds) {
      const commandType = getCommandType(c.type);
      console.log(`${c.name} (${commandType}): ${c.id}`);
    }
  }

  const globalCommandLoads = [];
  for (const command of globalCommandFiles) {
    const load = require(path.resolve(commandPath, command));
    globalCommandLoads.push(load);
  }
  /** @type {ReturnedCommand|void} */
  // @ts-expect-error
  const global = await axios({
    method: "put",
    url: `https://discord.com/api/v8/applications/${applicationId}/commands`,
    headers: { Authorization: `Bot ${config.token}` },
    data: globalCommandLoads
  }).catch(displayError);
  if (global) {
    console.log("=====Global commands registered=====");
    const cmds = global.data;
    for (const c of cmds) {
      const commandType = getCommandType(c.type);
      console.log(`${c.name} (${commandType}): ${c.id}`);
    }
  }
  const files = { commands: Object.fromEntries((global?.data ?? []).concat(guild.data).map(cmd => {
    return [
      `${getCommandType(cmd.type)}${cmd.name[0].toUpperCase()}${cmd.name.substring(1).toLowerCase()}`,
      cmd.id
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]))) };
  fs.writeFileSync(path.resolve(__dirname, "./config/snowflakes-commands.json"), JSON.stringify(files, null, 2));
  fs.writeFileSync(path.resolve(__dirname, "./config/snowflakes-commands-example.json"), JSON.stringify({ commands: Object.fromEntries(Object.keys(files.commands).map(f => [f, ""])) }, null, 2));
  console.log("Command snowflake files updated");
  process.exit();
}

register();