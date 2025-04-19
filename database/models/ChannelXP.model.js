// @ts-check
const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const ChannelXPSchema = new Schema({
  channelId: {
    type: String,
    required: true
  },
  xp: {
    type: Number,
    default: 0,
    required: true
  }
});

module.exports = mongoose.model("ChannelXP", ChannelXPSchema);
