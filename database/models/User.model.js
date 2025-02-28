// @ts-check
const mongoose = require('mongoose'),
  Schema = mongoose.Schema;


const UserSchema = new Schema({
  discordId: {
    type: String,
    unique: true,
    required: true
  },
  roles: {
    type: [String],
    default: []
  },
  badges: {
    type: [String],
    default: []
  },
  posts: {
    type: Number,
    default: 0
  },
  voice: {
    type: Number,
    default: 0
  },
  trackXP: {
    type: Number,
    default: 1
  },
  currentXP: {
    type: Number,
    default: 0
  },
  totalXP: {
    type: Number,
    default: 0
  },
  priorTenure: {
    type: Number,
    default: 0
  },
  watching: {
    type: Boolean,
    default: false
  },
  sendBdays: {
    type: Number,
    default: 2
  }
});

module.exports = mongoose.model("User", UserSchema);
