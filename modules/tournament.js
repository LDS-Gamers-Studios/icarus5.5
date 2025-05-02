// @ts-check

const Augur = require("augurbot-ts"),
  axios = require('axios'),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  Module = new Augur.Module();


/**
 * Get tournament data
 * @param {string} state
 * @returns {Promise<{start_at: string, name: string, full_challonge_url: string}>} // there are a LOT more properties, log 'em if you need more at some point
 */
async function getTournaments(state) {
  // parameters for the url
  const urlParams = `api_key=${encodeURIComponent(config.api.challonge)}&state=${encodeURIComponent(state)}&subdomain=ldsg`;
  const url = "https://api.challonge.com/v1/tournaments.json?" + urlParams;

  // @ts-ignore... it can be called lol
  const response = await axios({ url, method: "get" }).catch((/** @type {axios.AxiosError} */ e) => {
    throw new Error("Tournament API Call Error " + e.status);
  });
  return response.data.map((/** @type {{ tournament: any }} */ t) => t.tournament);
}

Module.addInteraction({ name: "tournaments",
  id: u.sf.commands.slashTournaments,
  onlyGuild: true,
  options: { registry: "slashTournaments" },
  process: async (int) => {
    await int.deferReply({ flags: ["Ephemeral"] });
    const responses = await Promise.all([
      getTournaments("pending"),
      getTournaments("in_progress")
    ]);

    const tournaments = responses.flat().sort((a, b) => (new Date(a.start_at)).valueOf() - (new Date(b.start_at).valueOf()));

    /** @type {string[]} */
    const displayTourneys = [];
    for (const tournament of tournaments) {
      const displayDate = (tournament.start_at ? u.time(new Date(tournament.start_at), "D") : "Unscheduled");
      displayTourneys.push(`${displayDate}: [${tournament.name}](${tournament.full_challonge_url})`);
    }

    if (displayTourneys.length === 0) return int.editReply("Looks like there aren't any tourneys scheduled right now.");
    const embed = u.embed()
      .setTitle("Upcoming and Current LDSG Tournaments")
      .setDescription(`\n\nCommunity Tournaments:\n${displayTourneys.join('\n')}`);
    int.editReply({ embeds: [embed] });
  }
});

module.exports = Module;