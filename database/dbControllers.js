// @ts-check
const config = require("../config/config.json"),
  mongoose = require("mongoose");

const bank = require("./controllers/bank"),
  ign = require("./controllers/ign"),
  infraction = require("./controllers/infraction"),
  tags = require("./controllers/tag"),
  oauth = require("./controllers/oauth"),
  user = require("./controllers/user"),
  reminder = require("./controllers/reminder"),
  tournament = require("./controllers/tournament");

const { data, loadData, mappers } = require("./sheets");

mongoose.connect(config.db.db, config.db.settings);

module.exports = {
  bank,
  ign,
  infraction,
  tags,
  oauth,
  user,
  reminder,
  tournament,
  sheets: { ...data, loadData, mappers }
};