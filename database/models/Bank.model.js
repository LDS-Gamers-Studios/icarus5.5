// @ts-check
const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const BankSchema = new Schema({
  discordId: {
    type: String,
    required: true
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
    required: true
  },
  currency: {
    type: String,
    default: "em"
  },
  giver: {
    type: String,
    required: true,
    default: "UNKNOWN"
  },
  otherUser: {
    type: String,
    required: false
  },
  hp: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Bank", BankSchema);
