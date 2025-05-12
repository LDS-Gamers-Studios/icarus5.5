// @ts-check

const { GoogleSpreadsheet, GoogleSpreadsheetRow } = require("google-spreadsheet");
const config = require("../config/config.json");
const { JWT } = require("google-auth-library");
const { nanoid } = require("nanoid");
const { Client, Collection, Role } = require("discord.js");
const types = require("./sheetTypes");
const sf = config.devMode ? require("../config/snowflakes-testing.json") : require("../config/snowflakes.json");
const { setBadgeData } = require("../utils/badges");

const data = {
  data: {
    /** @type {GoogleSpreadsheetRow[]} */
    games: [],
    /** @type {GoogleSpreadsheetRow[]} */
    igns: [],
    /** @type {GoogleSpreadsheetRow[]} */
    missionaries: [],
    /** @type {GoogleSpreadsheetRow[]} */
    optRoles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    roles: [],
    /** @type {GoogleSpreadsheetRow[]} */
    sponsors: [],
    /** @type {GoogleSpreadsheetRow[]} */
    starboards: [],
    /** @type {GoogleSpreadsheetRow[]} */
    tourneyChampions: [],
    /** @type {GoogleSpreadsheetRow[]} */
    vcNames: [],
    /** @type {GoogleSpreadsheetRow[]} */
    wipChannels: [],
    /** @type {GoogleSpreadsheetRow[]} */
    xpSettings: [],
    /** @type {{ config: GoogleSpreadsheet, games: GoogleSpreadsheet } | null}} */
    docs: null
  },
  games: {
    /** @type {Collection<string, types.Game>} */
    purchased: new Collection(),
    /** @type {Collection<string, types.Game>} */
    available: new Collection()
  },
  /** @type {Collection<string, types.IGN>} */
  igns: new Collection(),
  /** @type {Collection<string, string>} */
  missionaries: new Collection(),
  /** @type {Collection<string, types.OptRole>} */
  optRoles: new Collection(),
  roles: {
    /** @type {Collection<string, types.Role>} */
    all: new Collection(),
    /** @type {Collection<string, Omit<types.Role, "level"> & { level: import("../utils/perms").Perms }>} */
    team: new Collection(),
    /** @type {Collection<string, Omit<types.Role, "color"> & { color: Role }>} */
    equip: new Collection(),
    /** @type {Collection<number, Omit<types.Role, "level"> & { level: string }>} */
    rank: new Collection(),
    /** @type {Collection<number, Omit<types.Role, "level"> & { level: string }>} */
    year: new Collection(),
  },
  /** @type {Collection<string, types.Sponsor>} */
  sponsors: new Collection(),
  /** @type {Collection<string, types.Starboard>} */
  starboards: new Collection(),
  /** @type {Collection<string, types.TourneyChampion>} */
  tourneyChampions: new Collection(),
  /** @type {string[]} */
  vcNames: [],
  /** @type {Collection<string, types.PlayingDefault>} */
  wipChannels: new Collection(),
  /** @type {{ channels: Collection<string, types.ChannelXPSetting>, banned: Set<string> }} */
  xpSettings: { banned: new Set(), channels: new Collection() },
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

/**
 * @param {Client} client
 */
function getServer(client) {
  return client.guilds.cache.get(sf.ldsg);
}

const sheetMap = {
  games: [],
  igns: ["IGN", "System"],
  missionaries: ["Mail", "UserId"],
  optRoles: ["Opt-In Roles", "RoleID"],
  roles: ["Roles", "Base Role ID"],
  sponsors: ["Sponsor Channels", "Sponsor"],
  starboards: ["Starboards", "ChannelID"],
  tourneyChampions: ["Tourney Champions", "Key"],
  vcNames: ["Voice Channel Names", "Name"],
  wipChannels: ["WIP Channel Defaults", "ChannelId"],
  xpSettings: ["XP Settings", "ChannelId"],
};

const mappers = {
  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {types.Game}
  */
  games: (row) => {
    const date = new Date(parseInt(row.get("Date")));
    return {
      title: row.get("Title"),
      system: row.get("System"),
      rating: row.get("Rating") || "E",
      cost: parseInt(row.get("Cost")),
      recipient: row.get("Recipient ID") || null,
      code: row.get("Code"),
      key: row.get("Key"),
      date: isNaN(date.valueOf()) ? null : date,
      steamId: row.get("Steam ID")
    };
  },

  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {types.IGN}
  */
  igns: (row) => ({
    aliases: row.get("Aliases")?.split(" ").filter(/** @param {string} a */a => noBlank(a)) ?? [],
    category: row.get("Category") || "Game Platforms",
    link: row.get("Link") || null,
    name: row.get("Name"),
    system: row.get("System")
  }),

  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {string}
  */
  missionaries: (row) => {
    return row.get("Email");
  },

  /**
   * @param {GoogleSpreadsheetRow} row
   * @param {Client} client
   * @returns {types.OptRole}
   */
  optRoles: (row, client) => {
    const id = row.get("RoleID");
    const role = getServer(client)?.roles.cache.get(id);
    if (!role) throw new Error(`Sheet Error - Missing Opt-Role: ${row.rowNumber} (${id})`);
    return {
      name: row.get("Role Tag"),
      badge: row.get("Badge") || null,
      role
    };
  },
  /**
   * @param {GoogleSpreadsheetRow} row
   * @param {Client} client
   * @returns {types.PlayingDefault}
   */
  wipChannels: (row, client) => {
    const id = row.get("ChannelId");
    const channel = getServer(client)?.channels.cache.get(id);
    if (!channel) throw new Error(`Sheet Error - Missing WIP Channel: ${row.rowNumber} (${id}, <#${id}>)`);
    return {
      channelId: id,
      name: row.get("Game Name")
    };
  },
  /**
   * @param {GoogleSpreadsheetRow} row
   * @param {Client} client
   * @returns {types.Role}
   */
  roles: (row, client) => {
    const baseId = row.get("Base Role ID");
    const colorId = row.get("Color Role ID");
    const base = getServer(client)?.roles.cache.get(baseId);
    const color = getServer(client)?.roles.cache.get(colorId) || null;
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

  /**
   * @param {GoogleSpreadsheetRow} row
   * @param {Client} client
   * @returns {types.Sponsor}
   */
  sponsors: (row, client) => {
    const date = new Date(row.get("Archive At"));
    const cId = row.get("Channel");
    const channel = client.getTextChannel(cId);
    if (cId && !channel) throw new Error(`Sheet Error - Missing Sponsor Channel: Row ${row.rowNumber}, ${cId}`);
    return {
      userId: row.get("Sponsor"),
      channel,
      emojiId: row.get("Emoji"),
      enabled: row.get("Enabled") === "TRUE",
      archiveAt: isNaN(date.valueOf()) ? null : date
    };
  },
  /**
   * @param {GoogleSpreadsheetRow} row
   * @param {Client} client
   * @returns {types.Starboard}
   */
  starboards: (row, client) => {
    const cId = row.get("ChannelID");
    const channel = client.getTextChannel(cId);
    if (!channel) throw new Error(`Sheet Error - Missing Starboard Channel: Row ${row.rowNumber}, ${cId}`);
    return {
      approval: row.get("Approval") === "TRUE",
      channel,
      priorityChannels: new Set(row.get("PriorityChannels")?.split(", ") || []),
      priorityEmoji: new Set(row.get("Reactions")?.split(", ") || []),
      threshold: parseInt(row.get("Threshold")),
    };
  },
  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {types.TourneyChampion}
   */
  tourneyChampions: (row) => {
    const date = new Date(parseInt(row.get("Take Role At")));
    return {
      tourneyName: row.get("Tourney Name"),
      userId: row.get("User ID"),
      takeAt: isNaN(date.valueOf()) ? null : date,
      key: row.get("Key")
    };
  },

  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {string}
   */
  vcNames: (row) => row.get("Name"),

  /**
   * @param {GoogleSpreadsheetRow} row
   * @returns {types.ChannelXPSetting}
   */
  xpSettings: (row) => {
    const posts = parseFloat(row.get("PostMultiplier"));
    // in the event that there are no emoji
    const emoji = new Set(row.get("Emoji")?.split(", ") ?? []);
    emoji.delete("");
    return {
      channelId: row.get("ChannelId"),
      emoji,
      posts: isNaN(posts) ? 1 : posts,
      preferMedia: row.get("PreferMedia") === "TRUE"
    };
  }
};

/**
 * @param {keyof Omit<data, "data">} sheet
 * @param {GoogleSpreadsheet} doc
 * @param {Client} client
 */
async function setData(sheet, doc, client) {
  if (sheet === "games") {
    data.data.games = await doc.sheetsByIndex[0].getRows();
    data.games.available.clear();
    data.games.purchased.clear();
    for (const game of data.data.games) {
      if (!game.get("Code") && game.get("Title")) {
        game.set("Code", nanoid(5).toUpperCase());
        game.save();
      }
      const mapped = mappers.games(game);
      if (mapped.recipient || mapped.date) data.games.purchased.set(mapped.code, mapped);
      else if (!data.games.available.find(g => g.title === mapped.title)) data.games.available.set(mapped.code, mapped);
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

  if (sheet === "roles") {
    data.roles.all.clear();
    data.roles.equip.clear();
    data.roles.rank.clear();
    data.roles.team.clear();
    data.roles.year.clear();
    for (const role of data.data.roles) {
      const type = role.get("Type");
      const id = role.get("Base Role ID");
      if (!id || type === "Comment") continue;
      /** @type {types.FullRole} */
      // @ts-expect-error sigh... the things we do to get things to work...
      const mapped = mappers.roles(role, client);
      if (mapped.color) data.roles.equip.set(id, mapped);
      switch (type) {
        // @ts-ignore
        case "Team Assign": data.roles.team.set(id, mapped); break;
        case "Rank": data.roles.rank.set(parseInt(mapped.level ?? "1000"), mapped); break;
        case "Year": data.roles.year.set(parseInt(mapped.level ?? "1000"), mapped); break;
        default: break;
      }
      data.roles.all.set(id, mapped);
    }
    return;
  }

  // hacky but fast way to clear an array without overriding it
  if (sheet === "vcNames") data[sheet].length = 0;
  else data[sheet].clear();

  for (const datum of data.data[sheet]) {
    const key = datum.get(sheetMap[sheet][1]);
    if (key) {
      if (sheet === "vcNames") data[sheet].push(key);
      // @ts-ignore i'm not writing a switch case for something thats meant to be procedural
      else data[sheet].set(key, mappers[sheet](datum, client));
    }
  }
}

/**
 * @param {Client} client
 * @param {keyof Omit<data, "data">} [sheet]
 */
async function loadData(client, loggedIn = true, justRows = false, sheet) {
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
      await setData(sheet, games, client);
      return data;
    }

    await setData(sheet, conf, client);
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
      promises.push(setData(typeCorrectKey, games, client));
    } else {
      promises.push(setData(typeCorrectKey, conf, client));
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
  mappers
};