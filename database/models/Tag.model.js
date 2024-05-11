// @ts-check

const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const TagSchema = new Schema({
  tag: { type: String, required: true, unique: true },
  response: String,
  attachment: String
});

module.exports = mongoose.model("Tag", TagSchema);