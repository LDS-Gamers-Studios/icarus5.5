// @ts-check
const config = require("../config/config.json"),
  mongoose = require("mongoose");

const bank = require("./controllers/bank"),
  ign = require("./controllers/ign"),
  infraction = require("./controllers/infraction"),
  oauth = require("./controllers/oauth"),
  user = require("./controllers/user"),
  tournament = require("./controllers/tournament");

const { data, loadData, makeDocument, mappers } = require("./sheets");

mongoose.connect(config.db.db, config.db.settings);

module.exports = {
  bank,
  ign,
  infraction,
  oauth,
  user,
  tournament,
  sheets: { ...data, loadData, makeDocument, mappers }
};