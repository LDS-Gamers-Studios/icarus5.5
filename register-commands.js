const config = require("./config/config.json"),
  u = require("./utils/utils"),
  path = require("path"),
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
  "slashGospel.js",
  "slashRank.js",
  "slashMod.js",
  "slashTournament.js",
  "slashVoice.js",
  "userMod.js"
];
/**********************
 * END "CONFIG" BLOCK *
 **********************/

function getCommandType(typeId) {
  let commandType;
  switch (typeId) {
  case 1:
    commandType = "Slash";
    break;
  case 2:
    commandType = "User";
    break;
  case 3:
    commandType = "Message";
    break;
  default:
    commandType = typeId;
  }
  return commandType;
}

function displayError(error) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log('Error', error.message);
  }
  console.log(error.config);
}

const applicationId = config.applicationId;
if (!applicationId) return console.log("Please put your application ID in config/config.json\nYou can find the ID here:\nhttps://discord.com/developers/applications");
const commandPath = path.resolve(require.main ? path.dirname(require.main.filename) : process.cwd(), "./registry");

const guildCommandLoads = [];
for (const command of guildCommandFiles) {
  const load = require(path.resolve(commandPath, command));
  guildCommandLoads.push(load);
}
axios({
  method: "put",
  url: `https://discord.com/api/v8/applications/${applicationId}/guilds/${u.sf.ldsg}/commands`,
  headers: { Authorization: `Bot ${config.token}` },
  data: guildCommandLoads
}).then((response) => {
  console.log("=====Guild commands registered=====");
  const cmds = response.data;
  for (const c of cmds) {
    const commandType = getCommandType(c.type);
    console.log(`${c.name} (${commandType}): ${c.id}`);
  }
  console.log();
}).catch(displayError);

const globalCommandLoads = [];
for (const command of globalCommandFiles) {
  const load = require(path.resolve(commandPath, command));
  globalCommandLoads.push(load);
}
axios({
  method: "put",
  url: `https://discord.com/api/v8/applications/${applicationId}/commands`,
  headers: { Authorization: `Bot ${config.token}` },
  data: globalCommandLoads
}).then((response) => {
  console.log("=====Global commands registered=====");
  const cmds = response.data;
  for (const c of cmds) {
    const commandType = getCommandType(c.type);
    console.log(`${c.name} (${commandType}): ${c.id}`);
  }
  console.log();
}).catch(displayError);
