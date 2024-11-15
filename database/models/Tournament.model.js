const mongoose = require('mongoose');
const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  game: {
    type: String,
    required: true,
  },
  system: {
    type: String,
    required: true,
  },
  organizerId: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true,
  },
  starts: {
    type: Date,
    required: true
  },
  participants: {
    type: [{
      id: {
        type: String,
        required: true
      },
      ign: {
        type: String,
        required: false
      }
    }],
    required: true,
    default: []
  }
});

module.exports = mongoose.model("Tournaments", TournamentSchema);