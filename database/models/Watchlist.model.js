const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const WatchedSchema = new Schema({
  discordId: String,
  untrusted: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Watched", WatchedSchema);
