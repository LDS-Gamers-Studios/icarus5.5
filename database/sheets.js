// @ts-check

const { GoogleSpreadsheet } = require("google-spreadsheet");
const config = require("../config/config.json");
const { JWT } = require("google-auth-library");
const { Client } = require("discord.js");
const types = require("./sheetTypes");
const sf = config.devMode ? require("../config/snowflakes-testing.json") : require("../config/snowflakes.json");
const { setBadgeData } = require("../utils/badges");
const Schemas = require("google-spreadsheet-schema");

/** @type {Client} */
let client;

/** @param {string} [sheetId] */
function makeDocument(sheetId) {
  const keys = config.google.creds;
  const auth = {
    email: keys.client_email,
    key: keys.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  };
  const account = new JWT(auth);
  const sheet = new GoogleSpreadsheet(sheetId ?? config.google.sheets.config, account);
  return sheet;
}

function getServer() {
  return client?.guilds.cache.get(sf.ldsg);
}

const sheetMap = {
  games: "",
  igns: "IGN",
  optRoles: "Opt-In Roles",
  roles: "Roles",
  sponsors: "Sponsor Channels",
  tourneyChampions: "Tourney Champions",
  vcNames: "Voice Channel Names",
  xpSettings: "XP Settings",
  wipChannels: "WIP Channel Defaults"
};

const functionSchemas = {
  /** @type {Schemas.Mapper<types.OptRole>} */
  optRoles: (row) => {
    const id = row.get("RoleID");
    const role = getServer()?.roles.cache.get(id);
    if (!role) throw new Error(`Sheet Error - Missing Opt-Role: ${row.rowNumber} (${id})`);
    return {
      name: row.get("Role Tag"),
      badge: row.get("Badge") || null,
      role
    };
  },
  /** @type {Schemas.Mapper<types.PlayingDefault>} */
  wipChannels: (row) => {
    const id = row.get("ChannelId");
    const channel = getServer()?.channels.cache.get(id);
    if (!channel) throw new Error(`Sheet Error - Missing WIP Channel: ${row.rowNumber} (${id}, <#${id}>)`);
    return {
      channelId: id,
      name: row.get("Game Name")
    };
  },
  /** @type {Schemas.Mapper<types.Sponsor>} */
  sponsors: (row) => {
    const date = new Date(row.get("Archive At"));
    const cId = row.get("Channel");
    const channel = client?.getTextChannel(cId);
    if (cId && !channel) throw new Error(`Sheet Error - Missing Sponsor Channel: Row ${row.rowNumber}, ${cId}`);
    return {
      userId: row.get("Sponsor"),
      channel,
      emojiId: row.get("Emoji") || null,
      enabled: row.get("Enabled") === "TRUE",
      archiveAt: isNaN(date.valueOf()) ? null : date
    };
  },
  /** @type {Schemas.Mapper<types.Role>} */
  rolesBase: (row) => {
    const baseId = row.get("Base Role ID");
    const colorId = row.get("Color Role ID");
    const base = getServer()?.roles.cache.get(baseId);
    const color = getServer()?.roles.cache.get(colorId) || null;

    if (!base) throw new Error(`Sheet Error - Missing Role: Row ${row.rowNumber}, ${baseId}`);
    if (colorId && !color) throw new Error(`Sheet Error - Missing Color Role: Row ${row.rowNumber}, ${colorId}`);
    return {
      type: row.get("Type"),
      base,
      color: color,
      parents: row.get("Parent Roles")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
      level: row.get("Level") || null,
      badge: row.get("Badge") || null,
    };
  },
  /** @type {Schemas.Mapper<types.ColorRole>} */
  colorRole: (row) => {
    const base = functionSchemas.rolesBase(row);
    const color = base.color;
    if (!color) throw new Error(`Sheet Error - Missing Color Role: Row ${row.rowNumber}`);
    return { ...base, color };
  },
  /** @type {Schemas.Mapper<types.LevelStrRole>} */
  levelRole: (row) => {
    const base = functionSchemas.rolesBase(row);
    const level = base.level;
    if (!level) throw new Error(`Sheet Error - Missing Level: Row ${row.rowNumber}`);
    return { ...base, level: level };
  },
  /** @type {Schemas.Mapper<types.LevelNumRole>} */
  numRole: (row) => {
    const base = functionSchemas.levelRole(row);
    return { ...base, level: parseInt(base.level) };
  }
};

const data = {
  /** @type {{ config: GoogleSpreadsheet, games: GoogleSpreadsheet } | null}} */
  docs: null,

  games: {
    purchased: new Schemas.ObjectSchema("code", {
      title: { key: "Title" },
      system: { key: "System" },
      rating: { key: "Rating", defaultValue: "E" },
      cost: { key: "Cost", type: "number" },
      code: { key: "Code" },
      key: { key: "Key" },
      steamId: { key: "Steam ID" },
      recipient: { key: "Recipient ID", possiblyNull: true },
      date: { key: "Date", type: "date", possiblyNull: true }
    }),
    available: new Schemas.ObjectSchema("code", {
      title: { key: "Title" },
      system: { key: "System" },
      rating: { key: "Rating", defaultValue: "E" },
      cost: { key: "Cost", type: "number" },
      code: { key: "Code" },
      key: { key: "Key" },
      steamId: { key: "Steam ID" },
    })
  },

  igns: new Schemas.ObjectSchema("system", {
    aliases: { key: "Aliases", splitter: " " },
    category: { key: "Category", defaultValue: "Game Platforms" },
    link: { key: "Link", possiblyNull: true },
    name: { key: "Name" },
    system: { key: "System" }
  }),

  tourneyChampions: new Schemas.ObjectSchema("key", {
    tourneyName: { key: "Tourney Name" },
    userId: { key: "User ID" },
    takeAt: { key: "Take Role At", type: "date" },
    key: { key: "Key" }
  }),

  vcNames: new Schemas.ArraySchema("Name"),

  xpSettings: {
    banned: new Schemas.SetSchema("BannedEmoji", "string"),
    channels: new Schemas.ObjectSchema("channelId", {
      posts: { key: "PostMultiplier", type: "number", defaultValue: 1 },
      channelId: { key: "ChannelId" },
      emoji: { key: "Emoji", splitter: ", " },
      preferMedia: { key: "PreferMedia", type: "boolean", defaultValue: false }
    })
  },

  roles: {
    all: new Schemas.SchemaFunction("Base Role ID", functionSchemas.rolesBase),
    team: new Schemas.SchemaFunction("Base Role ID", functionSchemas.levelRole),
    equip: new Schemas.SchemaFunction("Base Role ID", functionSchemas.colorRole),
    rank: new Schemas.SchemaFunction("Level", functionSchemas.numRole, "number"),
    year: new Schemas.SchemaFunction("Level", functionSchemas.numRole, "number"),
  },

  optRoles: new Schemas.SchemaFunction("RoleID", functionSchemas.optRoles),
  sponsors: new Schemas.SchemaFunction("Sponsor", functionSchemas.sponsors),
  wipChannels: new Schemas.SchemaFunction("ChannelId", functionSchemas.wipChannels),

};


/**
 * @param {keyof Omit<data, "docs">} sheet
 * @param {GoogleSpreadsheet} doc
 */
async function setData(sheet, doc) {
  if (sheet === "games") {
    const worksheet = doc.sheetsByIndex[0];
    const rows = await worksheet.getRows();

    await data.games.available.load(worksheet, (row) => !row.get("Recipient ID") && !row.get("Date"), rows);
    await data.games.purchased.load(worksheet, (row) => row.get("Recipient ID") || row.get("Date"), rows);
    return;
  }

  const worksheet = doc.sheetsByTitle[sheetMap[sheet]];

  if (sheet === "xpSettings") {
    const rows = await worksheet.getRows();

    await data.xpSettings.banned.load(worksheet, undefined, rows);
    await data.xpSettings.channels.load(worksheet, undefined, rows);
    return;
  }

  if (sheet === "roles") {
    const rows = await worksheet.getRows();

    await data.roles.all.load(worksheet, (row) => row.get("Type") !== "Comment", rows);
    await data.roles.equip.load(worksheet, (row) => row.get("Color Role ID"), rows);
    await data.roles.rank.load(worksheet, (row) => row.get("Type") === "Rank", rows);
    await data.roles.team.load(worksheet, (row) => row.get("Type") === "Team Assign", rows);
    await data.roles.year.load(worksheet, (row) => row.get("Type") === "Year", rows);
    return;
  }

  await data[sheet].load(worksheet);
}

/**
 * @param {Client} cli
 * @param {keyof Omit<data, "docs">} [sheet]
 */
async function loadData(cli, loggedIn = true, justRows = false, sheet) {
  client = cli;
  if (!loggedIn) data.docs = { config: makeDocument(), games: makeDocument(config.google.sheets.games) };
  if (!data.docs) throw new Error("Something has gone terribly wrong during sheets loadData");

  if (!justRows) {
    await data.docs.config.loadInfo();
    await data.docs.games.loadInfo();
  }

  const conf = data.docs.config;
  const games = data.docs.games;

  if (sheet) {
    if (sheet === "games") {
      await setData(sheet, games);
      return data;
    }

    await setData(sheet, conf);
    if (["roles", "optRoles"].includes(sheet)) setBadgeData(data.optRoles, data.roles);
    return data;
  }

  /** @type {Promise<void>[]} */
  const promises = [];
  for (const key in sheetMap) {
    /** @type {keyof typeof sheetMap} */
    // @ts-ignore
    const typeCorrectKey = key;
    if (typeCorrectKey === "games") {
      promises.push(setData(typeCorrectKey, games));
    } else {
      promises.push(setData(typeCorrectKey, conf));
    }
  }
  await Promise.all(promises);
  setBadgeData(data.optRoles, data.roles);
  return data;
}

const blank = ["", undefined, null];
/**
 * @param {any} e
 * @param {string} [key]
*/
function noBlank(e, key) {
  if (key && typeof e === "object") return !blank.includes(e[key]);
  return !blank.includes(e);
}

module.exports = {
  loadData,
  data,
  schemas: functionSchemas
};