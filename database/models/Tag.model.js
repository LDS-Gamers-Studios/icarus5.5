// @ts-check

const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const TagSchema = new Schema({
  tag: { type: String, required: true, unique: true },
  response: { type: String, default: null },
  attachment: { type: String, default: null },
  attachmentMime: { type: String, default: null }
});

module.exports = mongoose.model("Tag", TagSchema);