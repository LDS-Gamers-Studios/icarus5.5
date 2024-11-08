// @ts-check

const { GoogleSpreadsheet, GoogleSpreadsheetRow } = require("google-spreadsheet");
const config = require("../config/config.json");
const { JWT } = require("google-auth-library");
const { nanoid } = require("nanoid");

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
  /** @type {Game[]} */
  games: [],
  /** @type {IGN[]} */
  igns: [],
  /** @type {Role[]} */
  roles: [],
  /** @type {OptRole[]} */
  optRoles: [],
  /** @type {TourneyChampion[]} */
  tourneyChampions: [],
  /** @type {Sponsor[]} */
  sponsors: [],
  /** @type {string[]} */
  vcNames: []
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
  games: () => data.games = data.data.games.map(g => ({
    title: g.get("Title"),
    system: g.get("System"),
    rating: g.get("Rating") || "E",
    cost: parseInt(g.get("Cost")),
    recipient: g.get("Recipient ID") || undefined,
    code: g.get("Code"),
    key: g.get("Key"),
    date: new Date(parseInt(g.get("Date"))) || undefined,
    steamId: g.get("Steam ID")
  })).filter(g => noBlank(g, "cost")),

  igns: () => data.igns = data.data.igns.map(i => ({
    aliases: i.get("Aliases")?.split(" ") ?? [],
    category: i.get("Category") || "Game Platforms",
    link: i.get("Link") || "",
    name: i.get("Name"),
    system: i.get("System")
  })).filter(i => noBlank(i, "system")),

  roles: () => data.roles = data.data.roles.map(r => ({
    type: r.get("Type"),
    base: r.get("Base Role ID"),
    color: r.get("Color Role ID"),
    parents: r.get("Parent Roles")?.split(" ") ?? [],
    level: r.get("Level"),
    badge: r.get("Badge")
  })).filter(r => noBlank(r, "base")),

  optRoles: () => data.optRoles = data.data.optRoles.map(r => ({
    name: r.get("Role Tag"),
    id: r.get("RoleID"),
    badge: r.get("Badge")
  })).filter(r => noBlank(r, "id")),

  tourneyChampions: () => data.tourneyChampions = data.data.tourneyChampions.map(r => ({
    name: r.get("Tourney Name"),
    userId: r.get("User ID"),
    takeAt: new Date(r.get("Take Role At"))
  })).filter(c => noBlank(c, "userId")),

  sponsors: () => data.sponsors = data.data.sponsors.map(s => ({
    userId: s.get("Sponsor"),
    channelId: s.get("Channel"),
    emojiId: s.get("Emoji"),
    enabled: true,
    archiveAt: new Date()
  })).filter(s => noBlank(s, "userId")),

  vcNames: () => data.vcNames = data.data.vcNames.map(n => n.get("Name"))
    .filter(n => noBlank(n))
};

const sheetMap = {
  igns: "IGN",
  roles: "Roles",
  optRoles: "Opt-In Roles",
  tourneyChampions: "Tourney Champions",
  sponsors: "Sponsor Channels",
  vcNames: "Voice ChannelNames"
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
      for (const game of data.data.games.filter(g => !g.get("Code"))) {
        game.set("Code", nanoid());
        game.save();
      }
      mappers.games();
    } else {
      data.data[sheet] = await games.sheetsByTitle[sheetMap[sheet]].getRows();
      mappers[sheet]();
    }
    return;
  }

  data.data.games = await games.sheetsByIndex[0].getRows();
  data.data.igns = await conf.sheetsByTitle.IGN.getRows();
  data.data.roles = await conf.sheetsByTitle.Roles.getRows();
  data.data.optRoles = await conf.sheetsByTitle["Opt-In Roles"].getRows();
  data.data.tourneyChampions = await conf.sheetsByTitle["Tourney Champions"].getRows();
  data.data.sponsors = await conf.sheetsByTitle["Sponsor Channels"].getRows();
  data.data.vcNames = await conf.sheetsByTitle["Voice Channel Names"].getRows();

  for (const game of data.data.games.filter(g => !g.get("Code"))) {
    game.set("Code", nanoid());
    game.save();
  }

  mappers.games();
  mappers.igns();
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