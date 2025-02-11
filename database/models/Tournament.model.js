const mongoose = require('mongoose');

const participant = {
  id: {
    type: String,
    required: true
  },
  ign: {
    type: String,
  }
};

const team = {
  name: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  elimBracket: {
    type: {
      startSeed: {
        type: Number,
        default: 0
      },
      position: {
        type: Number,
        default: 0
      },
      fightingFor: {
        type: Number,
        default: 0
      },
      lostRound: {
        type: Number,
        default: 0
      },
      // enum
      lossReason: {
        type: Number,
        default: 0
      }
    },
    default: {}
  },
  roundOver: {
    type: Boolean,
    default: false
  },
  rrRounds: {
    type: [{
      opponentId: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        required: true
      },
      lossReason: {
        type: Number,
        required: true
      }
    }],
    default: []
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  participants: {
    type: [participant],
    default: []
  }
};

const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    required: true
  },
  system: {
    type: String,
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
    type: Number,
    required: true
  },
  roundLength: {
    type: Number,
    required: true
  },
  round: {
    type: Number,
    required: true,
    default: 0
  },
  // enum
  bracketStyle: {
    type: Number,
    required: true
  },
  teamSize: {
    type: Number,
    required: true,
    default: 0
  },
  teams: {
    type: [team],
    default: []
  },
  winners: {
    type: [String],
    default: []
  },
  over: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Tournaments", TournamentSchema);