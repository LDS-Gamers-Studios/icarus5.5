const mongoose = require('mongoose');
const OAuth2CredentialsSchema = new mongoose.Schema({
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  id: {
    type: String,
    required: true,
  }
});

module.exports = mongoose.model("OAuth2Credentials", OAuth2CredentialsSchema);