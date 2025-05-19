// @ts-check
const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const StarboardSchema = new Schema({
  messageId: {
    type: String,
    required: true
  },
  posted: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model("Starboard", StarboardSchema);
