const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const InfractionSchema = new Schema({
  discordId: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: false
  },
  flag: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  value: {
    type: Number,
    default: 0
  },
  mod: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model("Infraction", InfractionSchema);
