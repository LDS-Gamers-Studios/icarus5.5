// @ts-check
const config = require("../config/config.json"),
  mongoose = require("mongoose");

const bank = require("./controllers/bank"),
  ign = require("./controllers/ign"),
  infraction = require("./controllers/infraction"),
  tags = require("./controllers/tag"),
  user = require("./controllers/user"),
  reminder = require("./controllers/reminder"),
  starboard = require("./controllers/starboard"),
  tournament = require("./controllers/tournament");

const { data, loadData, schemas } = require("./sheets");

mongoose.connect(config.db.db, config.db.settings);

module.exports = {
  bank,
  ign,
  infraction,
  tags,
  user,
  reminder,
  starboard,
  tournament,
  sheets: { ...data, loadData, schemas }
};