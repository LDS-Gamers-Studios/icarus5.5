const Watch = require("../models/Watchlist.model");

module.exports = {
  addToWatchlist: async function(userId, untrusted = false) {
    const user = await Watch.findOne({ discordId: userId }).exec();
    if (user) {
      return false;
    }
    return new Watch({
      discordId: userId,
      untrusted: untrusted
    }).save();
  },
  fetchWatchlist: async function() {
    const watchlist = await Watch.find({}).exec();
    const wl = [];
    for (const entry of watchlist) {
      wl.push(entry.discordId);
    }
    return wl;
  },
  removeFromWatchlist: async function(userId) {
    const watch = Watch.findOneAndDelete({ discordId: userId });
    return watch;
  }
};