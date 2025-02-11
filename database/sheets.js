// @ts-check

const { GoogleSpreadsheet, GoogleSpreadsheetRow } = require("google-spreadsheet");
const config = require("../config/config.json");
const { JWT } = require("google-auth-library");
const { nanoid } = require("nanoid");
const { Collection } = require("discord.js");

/**
 * @typedef Game
 * @prop {string} title
 * @prop {string} system
 * @prop {string} rating
 * @prop {number} cost
 * @prop {string} [recipient]
 * @prop {string} code
 * @prop {string} key
 * @prop {string} [steamId]
 * @prop {Date} [date]
 */

/**
 * @typedef IGN
 * @prop {string} name
 * @prop {string} system
 * @prop {string} category
 * @prop {string[]} aliases
 * @prop {string} link
 */

/**
 * @typedef Role
 * @prop {"Equip"|"Comment"|"Team Assign"|"Rank"|"Year"} type
 * @prop {string} base
 * @prop {string} color
 * @prop {string[]} parents
 * @prop {string} level
 * @prop {string} badge
 */

/**
 * Role Tag	RoleID	Badge	Emoji
 * @typedef OptRole
 * @prop {string} name
 * @prop {string} id
 * @prop {string} badge
 */

/**
 * @typedef TourneyChampion
 * @prop {string} name
 * @prop {string} userId
 * @prop {Date} takeAt
 * @prop {string} key
 */

/**
 * @typedef Sponsor
 * @prop {string} userId
 * @prop {string} channelId
 * @prop {string} emojiId
 * @prop {boolean} enabled
 * @prop {Date} archiveAt
 */

/**
 * @typedef ChannelXPSetting
 * @prop {string} channelId
 * @prop {Set<string>} emoji
 * @prop {number} posts
 * @prop {boolean} preferMedia
 */
const data = {
  data: {
    /** @type {GoogleSpreadsheetRow[]} */
    games: [],
    /** @type {GoogleSpreadsheetRow[]} */
    igns: [],
    /** @type {GoogleSpreadsheetRow[]} */
    optRoles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    roles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    sponsors: [],
    /** @type {GoogleSpreadsheetRow[]} */
    tourneyChampions: [],
    /** @type {GoogleSpreadsheetRow[]} */
    vcNames: [],
    /** @type {GoogleSpreadsheetRow[]} */
    xpSettings: [],
    /** @type {{ config: GoogleSpreadsheet, games: GoogleSpreadsheet } | null}} */
    docs: null
  },
  /** @type {Collection<string, Game>} */
  games: new Collection(),
  /** @type {Collection<string, IGN>} */
  igns: new Collection(),
  /** @type {Collection<string, OptRole>} */
  optRoles: new Collection(),
  /** @type {Collection<string, Role>} */
  roles: new Collection(),
  /** @type {Collection<string, Sponsor>} */
  sponsors: new Collection(),
  /** @type {Collection<string, TourneyChampion>} */
  tourneyChampions: new Collection(),
  /** @type {Set<string>} */
  vcNames: new Set(),
  /** @type {{ channels: Collection<string, ChannelXPSetting>, banned: Set<string> }} */
  xpSettings: { banned: new Set(), channels: new Collection() }
};

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

const sheetMap = {
  games: [],
  igns: ["IGN", "System"],
  optRoles: ["Opt-In Roles", "RoleID"],
  roles: ["Roles", "Base Role ID"],
  sponsors: ["Sponsor Channels", "Sponsor"],
  tourneyChampions: ["Tourney Champions", "Key"],
  vcNames: ["Voice Channel Names", "Name"],
  xpSettings: ["XP Settings", "ChannelId"]
};

const mappers = {
  /** @param {GoogleSpreadsheetRow} row */
  games: (row) => ({
    title: row.get("Title"),
    system: row.get("System"),
    rating: row.get("Rating") || "E",
    cost: parseInt(row.get("Cost")),
    recipient: row.get("Recipient ID") || undefined,
    code: row.get("Code"),
    key: row.get("Key"),
    date: new Date(parseInt(row.get("Date"))) || undefined,
    steamId: row.get("Steam ID")
  }),

  /** @param {GoogleSpreadsheetRow} row */
  igns: (row) => ({
    aliases: row.get("Aliases")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
    category: row.get("Category") || "Game Platforms",
    link: row.get("Link") || "",
    name: row.get("Name"),
    system: row.get("System")
  }),

  /** @param {GoogleSpreadsheetRow} row */
  optRoles: (row) => ({
    name: row.get("Role Tag"),
    id: row.get("RoleID"),
    badge: row.get("Badge")
  }),

  /** @param {GoogleSpreadsheetRow} row */
  roles: (row) => ({
    type: row.get("Type"),
    base: row.get("Base Role ID"),
    color: row.get("Color Role ID"),
    parents: row.get("Parent Roles")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
    level: row.get("Level"),
    badge: row.get("Badge")
  }),

  /** @param {GoogleSpreadsheetRow} row */
  sponsors: row => ({
    userId: row.get("Sponsor"),
    channelId: row.get("Channel"),
    emojiId: row.get("Emoji"),
    enabled: true,
    archiveAt: new Date()
  }),

  /** @param {GoogleSpreadsheetRow} row */
  tourneyChampions: (row) => ({
    name: row.get("Tourney Name"),
    userId: row.get("User ID"),
    takeAt: new Date(row.get("Take Role At")),
    key: row.get("Key")
  }),

  /** @param {GoogleSpreadsheetRow} row */
  vcNames: (row) => row.get("Name"),

  /** @param {GoogleSpreadsheetRow} row */
  xpSettings: (row) => {
    const posts = parseFloat(row.get("PostMultiplier"));
    return {
      channelId: row.get("ChannelId"),
      emoji: new Set(row.get("Emoji")?.split(", ") ?? []),
      posts: isNaN(posts) ? 1 : posts,
      preferMedia: row.get("PreferMedia") === "TRUE"
    };
  }
};

/**
 * @param {keyof Omit<data, "data">} sheet
 * @param {GoogleSpreadsheet} doc
 */
async function setData(sheet, doc) {
  if (sheet === "games") {
    data.data.games = await doc.sheetsByIndex[0].getRows();
    data.games.clear();
    for (const game of data.data.games) {
      if (!game.get("code")) {
        game.set("Code", nanoid());
        game.save();
      }
      if (!data.games.find(g => g.title === game.get("Title"))) data.games.set(game.get("Code"), mappers.games(game));
    }
    return;
  }

  data.data[sheet] = await doc.sheetsByTitle[sheetMap[sheet][0]].getRows();
  if (sheet === "xpSettings") {
    data[sheet].banned.clear();
    data[sheet].channels.clear();
    for (const datum of data.data[sheet]) {
      const banned = datum.get("BannedEmoji");
      if (banned) data[sheet].banned.add(banned);

      const channel = datum.get(sheetMap[sheet][1]);
      if (channel) data[sheet].channels.set(channel, mappers[sheet](datum));
    }
    return;
  }

  data[sheet].clear();
  for (const datum of data.data[sheet]) {
    const key = datum.get(sheetMap[sheet][1]);
    if (key) {
      if (sheet === "vcNames") data[sheet].add(key);
      // @ts-expect-error i'm not writing a switch case for something thats meant to be procedural
      else data[sheet].set(key, mappers[sheet](datum));
    }
  }
}

/**
 * @param {keyof Omit<data, "data">} [sheet]
 */
async function loadData(loggedIn = true, justRows = false, sheet) {
  if (!loggedIn) data.data.docs = { config: makeDocument(), games: makeDocument(config.google.sheets.games) };
  if (!data.data.docs) throw new Error("Something has gone terribly wrong during sheets loadData");

  if (!justRows) {
    await data.data.docs.config.loadInfo();
    await data.data.docs.games.loadInfo();
  }

  const conf = data.data.docs.config;
  const games = data.data.docs.games;

  if (sheet) {
    if (sheet === "games") {
      await setData(sheet, games);
      return data.games;
    }

    await setData(sheet, conf);
    return data[sheet];
  }


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
  return data.data;
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
  makeDocument,
  data,
  mappers
};