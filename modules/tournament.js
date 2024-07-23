// @ts-check

const Augur = require("augurbot-ts"),
  axios = require('axios'),
  u = require("../utils/utils"),
  config = require('../config/config.json');


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
  return response.data.map(t => t.tournament);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function bracket(int) {
  await int.deferReply({ ephemeral: true });
  const responses = await Promise.all([
    getTournaments("pending"),
    getTournaments("in_progress")
  ]);

  const tournaments = responses.flat().sort((a, b) => (new Date(a.start_at)).valueOf() - (new Date(b.start_at).valueOf()));

  const displayTourneys = [];
  for (const tournament of tournaments) {
    const displayDate = (tournament.start_at ? u.time(new Date(tournament.start_at), "D") : "Unscheduled");
    displayTourneys.push(`${displayDate}: [${tournament.name}](${tournament.full_challonge_url})`);
  }

  if (displayTourneys.length == 0) return int.editReply("Looks like there aren't any tourneys scheduled right now.");
  const embed = u.embed()
    .setTitle("Upcoming and Current LDSG Tournaments")
    .setDescription(`\n\nCommunity Tournaments:\n${displayTourneys.join('\n')}`);
  int.editReply({ embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function champs(int) {
  await int.deferReply({ ephemeral: true });
  if (!config.google.sheets.config) {
    int.editReply("Looks like the bot isn't set up right to handle this. Please contact my developers.");
    return console.log("No Sheets ID");
  }
  const tName = int.options.getString('tournament');
  const user = (str) => int.options.getMember(str);
  const users = u.unique([user('1'), user('2'), user('3'), user('4'), user('5'), user('6')].filter(usr => usr != null));
  const date = new Date(Date.now() + (3 * 7 * 24 * 60 * 60 * 1000)).valueOf();
  // @ts-expect-error
  await u.sheet("Tourney Champions").addRows(users.map(usr => ({ "Tourney Name": tName, "User ID": usr?.id, "Take Role At": date })));
  for (const member of users) {
    member?.roles.add(u.sf.roles.champion);
  }
  const s = users.length > 1 ? 's' : '';
  Module.client.guilds.cache.get(u.sf.ldsg)?.client.getTextChannel(u.sf.channels.announcements)?.send(`## Congratulations to our new tournament champion${s}!\n${users.join(", ")}!\n\nTheir performance landed them the champion slot in the ${tName} tournament, and they'll hold on to the LDSG Tourney Champion role for a few weeks.`);
  int.editReply("Champions recorded and announced!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function participant(int) {
  const role = int.guild.roles.cache.get(u.sf.roles.tournamentparticipant);
  await int.deferReply({ ephemeral: true });
  if (!role) return u.errorHandler(new Error("No Tourney Champion Role"), int);
  const reset = int.options.getBoolean('reset');
  const remove = int.options.getBoolean('remove');
  const user = int.options.getMember('user');
  if (!user) return int.editReply("I couldn't find that user! They might have left the server.");
  if (reset) {
    let succeeded = 0;
    let i = 0;
    const members = role.members;
    while (i < members.size) {
      const member = members.at(i);
      try {
        await member?.roles.remove(role.id);
        succeeded++;
      } catch (error) {null;}
      i++;
    }
    return int.editReply(`Removed ${succeeded}/${members.size} people from the ${role} role`);
  } else if (remove) {
    if (user.roles.cache.has(role.id)) {
      let content = `I removed the ${role} role from ${user}`;
      await user.roles.remove(role.id).catch(() => content = `I couldn't remove the ${role} role from ${user}`);
      return int.editReply(content);
    } else {
      return int.editReply(`${user} doesn't have the ${role} role`);
    }
  } else if (!user.roles.cache.has(role.id)) {
    let content = `I added the ${role} role to ${user}`;
    await user.roles.add(role.id).catch(() => content = `I couldn't add the ${role} role to ${user}`);
    return int.editReply({ content });
  } else {
    return int.editReply(`${user} already has the ${role} role`);
  }
}

const Module = new Augur.Module()
.addInteraction({ name: "tournament",
  id: u.sf.commands.slashTournament,
  onlyGuild: true,
  // Only /tournament list is publicly available
  permissions: (int) => int.options.getSubcommand() == 'list' ? true : u.perms.calc(int.member, ["team", "mgr"]),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
      case "list": return bracket(int);
      case "champion": return champs(int);
      case "participant": return participant(int);
    }
  }
});

module.exports = Module;