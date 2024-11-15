// @ts-check
const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const IgnSchema = new Schema({
  discordId: {
    type: String,
    required: true
  },
  system: {
    type: String,
    required: true
  },
  ign: {
    type: String,
    required: true
  },
});

module.exports = mongoose.model("Ign", IgnSchema);
