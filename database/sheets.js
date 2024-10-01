// @ts-check

const { GoogleSpreadsheet, GoogleSpreadsheetRow } = require("google-spreadsheet");
const config = require("../config/config.json");
const { JWT } = require("google-auth-library");

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
    roles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    optRoles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    tourneyChampions: [],
    /** @type {GoogleSpreadsheetRow[]} */
    sponsors: [],
    /** @type {GoogleSpreadsheetRow[]} */
    vcNames: [],
    /** @type {GoogleSpreadsheet | null} */
    doc: null
  },
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

async function loadData(loggedIn = true) {
  if (!loggedIn) data.data.doc = makeDocument();
  if (!data.data.doc) throw new Error("Something has gone terribly wrong during sheets loadData");
  await data.data.doc.loadInfo();

  data.data.roles = await data.data.doc.sheetsByTitle.Roles.getRows();
  data.data.optRoles = await data.data.doc.sheetsByTitle["Opt-In Roles"].getRows();
  data.data.tourneyChampions = await data.data.doc.sheetsByTitle["Tourney Champions"].getRows();
  data.data.sponsors = await data.data.doc.sheetsByTitle["Sponsor Channels"].getRows();
  data.data.vcNames = await data.data.doc.sheetsByTitle["Voice Channel Names"].getRows();

  data.roles = data.data.roles.map(r => ({
    type: r.get("Type"),
    base: r.get("Base Role ID"),
    color: r.get("Color Role ID"),
    parents: r.get("Parent Roles")?.split(" ") ?? [],
    level: r.get("Level"),
    badge: r.get("Badge")
  })).filter(r => noBlank(r, "base"));

  data.optRoles = data.data.optRoles.map(r => ({
    name: r.get("Role Tag"),
    id: r.get("RoleID"),
    badge: r.get("Badge")
  })).filter(r => noBlank(r, "id"));

  data.tourneyChampions = data.data.tourneyChampions.map(r => ({
    name: r.get("Tourney Name"),
    userId: r.get("User ID"),
    takeAt: new Date(r.get("Take Role At"))
  })).filter(c => noBlank(c, "userId"));

  data.sponsors = data.data.sponsors.map(s => ({
    userId: s.get("Sponsor"),
    channelId: s.get("Channel"),
    emojiId: s.get("Emoji"),
    enabled: true,
    archiveAt: new Date()
  })).filter(s => noBlank(s, "userId"));

  data.vcNames = data.data.vcNames.map(n => n.get("Name"))
    .filter(n => noBlank(n));
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
  data
};