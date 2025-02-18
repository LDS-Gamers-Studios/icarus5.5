# Table of Contents
- [Requirements](#requirements)
- [Set Up A Test Instance](#setting-up-a-test-instance)
    - [File Explainations](#file-explanations)
- [Contributing](#contributing)
    - [PR Approvals](#pull-request-approvals)

# Requirements
- This guide assumes you are moderately familiar with Discord bots and the Discord API.
- [MongoDB](https://www.mongodb.com/) ***(Version - ^4.0.22)***
- [Node.js](https://nodejs.org/) ***(Version - ^16.13.1)***

# Setting Up A Test Instance
1. Create a [Discord bot application](https://discord.com/developers/applications). It must have all privileged intents enabled. Note the bot token and applicationId.

![Creation Process](https://github.com/LDS-Gamers-Studios/icarus5.5/blob/main/docs/createbot.png?raw=true)

2. Invite your bot to the official Icarus test server (Talk to BobbyTheCatfish or the current Bot Owner). Send them your bot invite link. When creating said link, do not add any permissions. They will be assigned via a custom role in the server that is updated based on the real Icarus's permissions. 
3. Clone the repository.

![Clone Repo](https://github.com/LDS-Gamers-Studios/icarus5.5/blob/main/docs/clonerepo.png?raw=true)

4. Create a [local database](https://www.mongodb.com/try/download/community), or try the server based [Atlas Shared Tier](https://www.mongodb.com/cloud/atlas/register). For the sake of this tutorial, I will be using the server based version.
    1. Sign up for an Atlas Shared Tier, selecting the free M0 option
    
    ![M0 Free Tier](https://github.com/LDS-Gamers-Studios/icarus5.5/blob/main/docs/mzero.png?raw=true)

    2. When prompted to connect, choose the Compass option. If you haven't installed Compass yet, it will provide instructions to do so. Installing it is not required, but will help with setup.
    3. Take note of your connection string. It'll have the format of `mongodb+srv://<username>:<password>@<connection>`. You can copy and paste that into Compass and try connecting. Note this somewhere you can come back to later.
    4. Create a new database called `icarus`, and a collection called `bank`. This will act as a base to start, and Icarus should be able to create new collections and records on its own.
5. Create the following files, based on their matching `-example` file: `config/config.json`, `config/snowflake-testing-commands.json`, and `data/banned.json`. Explanations of these files can be found below.
6. Within the root folder of the repo, run `npm ci`.
7. Run `node register-commands.js` to register all of the interaction commands with the Discord API. Note the IDs of the commands for configuring the bot later.
8. The start-up command is `node .`. If you want to be fancy, you can start a debugging instance as well.

## File Explanations
For the bot to successfully run, you'll need to create or edit a few files first. These files, for various reasons, are excluded from the repository. However, example files are provided to make their creation easier.

### `config/config.json`
Required items:

(Just as a general rule of thumb, if there's a placeholder string you should probably change it to the correct value.)
- `adminId`: put your ID in there.
- `ownerId`: put your ID there
- `api.snipcart`: required to run `/bank discount`. Can otherwise be left blank.
- `api.steam`: required to run `/bank game list`. Can otherwise be left blank, but will create an error message on loading `bank.js`. An API key can be requested [here](https://steamcommunity.com/dev/apikey).
- `applicationId`: The applicationId you took note of during bot creation
- `db`: This is the connection info for Mongo. Recall the connection string you noted down earlier. The format is `mongodb+srv://<username>:<password>@<connection>`
- - `db.db`: `mongodb+srv://<connection>/icarus`
- - `db.settings.user`: the `<username>` part of the string.
- - `db.settings.pass`: the `<password>` part of the string.
- `error.url`: the URL of a Discord webhook for posting error messages. This can be obtained by pinging the current Bot Owner and asking for it.
- `google`: information for the Google API. You can obtain API credentials [here](https://console.cloud.google.com/apis/library/sheets.googleapis.com). IDs for the testing sheets can be found in the [#info](https://discord.com/channels/1207041599608061962/1208925579743854638) channel.
- `prefix`: Change this to something unique
- `token`: the bot's token for login.

### `data/banned.json`
The provided example can be copied without modification.

### `config/snowflakes-testing-commands.json`
The provided example can be copied without modification.

# Contributing

## Software
Use of the following software is reccomended to make contributions easier.
- [Github Desktop](https://desktop.github.com/) to make Git easier
- [VSCode](https://code.visualstudio.com/)
- [ESLint Plugin for VSC](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) (if you choose a different IDE, you should find an extension for ESLint and the typescript server)
- [MongoDB Compass](https://www.mongodb.com/products/tools/compass) to make viewing DB entries easier

## Code Quality
To ensure the quality of the code we upload to the repo, two safeguards are currently in place.

### ESLint
ESLint is a JavaScript plugin that checks all the javascript files for [linting issues](https://stackoverflow.com/a/30339671)
A pull request must have 0 linting issues in order to be approved. There are automatic checks in place to enforce this. Plugins such as the before mentioned one for VSC allow you to see these errors in your code editor and are highly reccomended.

### // @ts-check
Welcome to the wonderful but also frustrating world of typescript-check. Javascript is what's known as a [weakly  typed language](https://www.linkedin.com/advice/0/what-difference-between-strongly-weakly-typed-eqwlc#:~:text=Sign%20in-,Last%20updated%20on%20Mar%2019%2C%202024,What%20is%20weak%20typing%3F,-Weak%20typing%20means). Typescript, on the other hand, is a form of javascript that enforces types. This prevents a lot of silly errors such as passing the wrong variable into a function, getting undefined properties (ie: foo.bob when you meant foo.bar), and so on. 

Typescript is actually already running in the background when you work on javascript code, especially in VSC. It's the whole reason intellisense (or the variable suggestions) works. So what's ``// @ts-check`? While the typescript server provides variables in normal JS files, it's usually not able to tell you if you've made any type errors. // @ts-check, mixed with JSDoc (which allows you to assign types to variables) allows it to display type errors in the document, showing potential mistakes. You can find more information [here](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html).

BobbyTheCatfish knows his way around this pretty well, so reach out to him if you're having to do weird things to clear errors, or if you're wondering if there's a better way to do something.

## Pull Request Approvals
In order for a pull request to be approved, the following requirements have to be met:
- All changes have been tested on both your and the reviewer's instances of icarus and are confirmed working. Note for reviewers: make sure to `npm ci` and restart your code editor so you don't get any caching issues before testing.
- A quick look through by both parties of all modified files to see if any features should behave differently
- All user seen strings need to be LDSG-Worthy
- All changes to `config.json` (new properties, changed defaults, etc) need to be reflected in `config/config-example.json` with a description if possible
- All IDs (snowflakes) need to be put in `config/snowflakes.json` (real IDs) and `config/snowflakes-testing.json` (testing IDs).
- All interactions that need registration must follow the style of the existing files in `/registry`
- All functions must have valid JSDoc describing the types of parameters, as well as the return type if really needed.
- All new dependencies should be reflected in `package.json` and `package-lock.json`
- Minimal @ts-check errors (message the Bot Owner if you're having trouble)
- No ESLint errors
