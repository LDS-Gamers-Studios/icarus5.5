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

const data = {
  data: {
    /** @type {GoogleSpreadsheetRow[]} */
    games: [],
    /** @type {GoogleSpreadsheetRow[]} */
    igns: [],
    /** @type {GoogleSpreadsheetRow[]} */
    roles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    optRoles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    tourneyChampions: [],
    /** @type {GoogleSpreadsheetRow[]} */
    sponsors: [],
    /** @type {GoogleSpreadsheetRow[]} */
    vcNames: [],
    /** @type {{ config: GoogleSpreadsheet, games: GoogleSpreadsheet } | null} */
    docs: null
  },
  /** @type {Collection<string, Game>} */
  games: new Collection(),
  /** @type {Collection<string, IGN>} */
  igns:  new Collection(),
  /** @type {Collection<string, Role>} */
  roles:  new Collection(),
  /** @type {Collection<string, OptRole>} */
  optRoles: new Collection(),
  /** @type {Collection<string, TourneyChampion>} */
  tourneyChampions: new Collection(),
  /** @type {Collection<string, Sponsor>} */
  sponsors: new Collection(),
  /** @type {Collection<string, string>} */
  vcNames: new Collection()
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

const mappers = {
  /** @param {GoogleSpreadsheetRow} p */
  games: (p) => ({
    title: p.get("Title"),
    system: p.get("System"),
    rating: p.get("Rating") || "E",
    cost: parseInt(p.get("Cost")),
    recipient: p.get("Recipient ID") || undefined,
    code: p.get("Code"),
    key: p.get("Key"),
    date: new Date(parseInt(p.get("Date"))) || undefined,
    steamId: p.get("Steam ID")
  }),

  /** @param {GoogleSpreadsheetRow} i */
  igns: (i) => ({
    aliases: i.get("Aliases")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
    category: i.get("Category") || "Game Platforms",
    link: i.get("Link") || "",
    name: i.get("Name"),
    system: i.get("System")
  }),
  /** @param {GoogleSpreadsheetRow} r\ */
  roles: (r) => ({
    type: r.get("Type"),
    base: r.get("Base Role ID"),
    color: r.get("Color Role ID"),
    parents: r.get("Parent Roles")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
    level: r.get("Level"),
    badge: r.get("Badge")
  }),

  /** @param {GoogleSpreadsheetRow} r */
  optRoles: (r) => ({
    name: r.get("Role Tag"),
    id: r.get("RoleID"),
    badge: r.get("Badge")
  }),

  /** @param {GoogleSpreadsheetRow} r */
  tourneyChampions: (r) => ({
    name: r.get("Tourney Name"),
    userId: r.get("User ID"),
    takeAt: new Date(r.get("Take Role At")),
    key: r.get("Key")
  }),

  /** @param {GoogleSpreadsheetRow} s */
  sponsors: (s) => ({
    userId: s.get("Sponsor"),
    channelId: s.get("Channel"),
    emojiId: s.get("Emoji"),
    enabled: true,
    archiveAt: new Date()
  }),

  /** @param {GoogleSpreadsheetRow} n */
  vcNames: (n) => n.get("Name")
};

const sheetMap = {
  igns: ["IGN", "System"],
  roles: ["Roles", "Base Role ID"],
  optRoles: ["Opt-In Roles", "RoleID"],
  tourneyChampions: ["Tourney Champions", "Key"],
  sponsors: ["Sponsor Channels", "Sponsor"],
  vcNames: ["Voice Channel Names", "Name"]
};

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
      data.data.games = await games.sheetsByIndex[0].getRows();
      data.games.clear();
      for (const game of data.data.games) {
        if (!game.get("Title")) {
          game.set("Code", nanoid());
          game.save();
        }
        if (!data.games.find(g => g.title === game.get("Title"))) data.games.set(game.get("Code"), mappers.games(game));
      }
    } else {
      data.data[sheet] = await games.sheetsByTitle[sheetMap[sheet][0]].getRows();
      data[sheet].clear();
      for (const datum of data.data[sheet]) {
        if (datum.get(sheetMap[sheet][1]))data[sheet].set(datum.get(sheetMap[sheet][1]), mappers[sheet](datum));
      }
    }
    return;
  }

  data.data.games = await games.sheetsByIndex[0].getRows();
  data.games.clear();
  for (const game of data.data.games) {
    if (!game.get("Code")) {
      game.set("Code", nanoid());
      game.save();
    }
    if (!data.games.find(g => g.title === game.get("Title"))) data.games.set(game.get("Code"), mappers.games(game));
  }

  for (const key in sheetMap) {
    /** @type {keyof typeof sheetMap} */
    // @ts-ignore
    const typeCorrectKey = key;
    const s = sheetMap[typeCorrectKey];
    data[typeCorrectKey].clear();
    data.data[typeCorrectKey] = await conf.sheetsByTitle[s[0]].getRows();
    for (const datum of data.data[typeCorrectKey]) {
      if (datum.get(s[1])) data[typeCorrectKey].set(datum.get(s[1]), mappers[typeCorrectKey](datum));
    }
  }
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