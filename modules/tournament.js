// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  perms = require('../utils/perms'),
  discord = require('discord.js');

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function bracket(int) {
  const challonge = require("../utils/ChallongeAPI").init(config.api.challonge);
  const embed = u.embed().setTitle("Upcoming and Current LDSG Tournaments");
  await int.deferReply({ ephemeral: true });
  const responses = await Promise.all([
    challonge.getTournamentsIndex({ state: "pending", subdomain: "ldsg" }),
    challonge.getTournamentsIndex({ state: "in_progress", subdomain: "ldsg" })
  ]);

  const tournaments = responses.reduce((full, response) => full.concat(response), [])
    .sort((a, b) => (new Date(a.tournament.start_at)).valueOf() - (new Date(b.tournament.start_at).valueOf()));

  const displayTourneys = [];
  for (const tournament of tournaments) {
    let displayDate = (tournament.tournament.start_at ? new Date(tournament.tournament.start_at.substr(0, tournament.tournament.start_at.indexOf("T"))) : "Unscheduled");
    if (typeof displayDate != "string") displayDate = displayDate.toLocaleDateString("en-us");
    displayTourneys.push(`${displayDate}: [${tournament.tournament.name}](${tournament.tournament.full_challonge_url})`);
  }

  if (displayTourneys.length == 0) return int.editReply({ content: "Looks like there aren't any tourneys scheduled right now." });
  else embed.setDescription(`\n\nCommunity Tournaments:\n${displayTourneys.join('\n')}`);
  int.editReply({ embeds: [embed] });
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function champs(int) {
  if (!config.google.sheets.config) return console.log("No Sheets ID");
  const tName = int.options.getString('tourney-name');
  const user = (str) => int.options.getMember(str);
  const users = [user('1'), user('2'), user('3'), user('4'), user('5'), user('6')].filter(Boolean);
  console.log(users);
  const date = new Date(Date.now() + (3 * 7 * 24 * 60 * 60 * 1000)).toString();
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  await doc.useServiceAccountAuth(config.google.creds);
  await doc.loadInfo();
  for (const member of users) {
    member?.roles.add(u.sf.roles.champion);
    // @ts-ignore
    await doc.sheetsByTitle["Tourney Champions"].addRow({ "Tourney Name": tName, "User ID": member?.id, "Take Role At": date });
  }
  const s = users.length > 1 ? 's' : '';
  Module.client.guilds.cache.get(u.sf.ldsg)?.client.getTextChannel(u.sf.channels.announcements)?.send(`Congratulations to our new tournament champion${s}, ${users.join(", ")}!\n\nTheir performance landed them the champion slot in the ${tName} tournament, and they'll hold on to the LDSG Tourney Champion role for a few weeks.`);
  int.reply({ ephemeral: true, content: "Champions registered!" });
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function participant(int) {
  const role = int.guild.roles.cache.get(u.sf.roles.tournamentparticipant);
  if (!role) return;
  const clean = int.options.getBoolean('remove-all');
  const remove = int.options.getBoolean('remove');
  const user = int.options.getMember('user');
  let succeeded = 0;
  if (clean) {
    let i = 0;
    const members = role?.members ?? new discord.Collection;
    while (i < members.size) {
      const member = members.at(i);
      try {
        await member?.roles.remove(role.id);
        succeeded++;
      } catch (error) {null;}
      i++;
    }
    return int.reply({ content: `Removed ${succeeded}/${members.size} people from the ${role} role`, ephemeral: true });
  } else if (remove) {
    if (user?.roles.cache.has(role.id)) {
      let content = `I removed the ${role} role from ${user}`;
      await user.roles.remove(role.id).catch(() => content = `I couldn't remove the ${role} role from ${user}`);
      return int.reply({ content, ephemeral: true });
    } else {
      return int.reply({ content: `${user} doesn't have the ${role} role`, ephemeral: true });
    }
  } else if (!user?.roles.cache.has(role.id)) {
    let content = `I added the ${role} role to ${user}`;
    await user?.roles.add(role.id).catch(() => content = `I couldn't add the ${role} role to ${user}`);
    return int.reply({ content, ephemeral: true });
  } else {
    return int.reply({ content: `${user} already has the ${role} role`, ephemeral: true });
  }
}

const Module = new Augur.Module()
.addInteraction({ name: "tournament",
  id: u.sf.commands.slashTournament,
  onlyGuild: true,
  permissions: (int) => int.options.getSubcommand() == 'list' ? true : perms.isTeam(int),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
    case "list": return bracket(int);
    case "champion": return champs(int);
    case "participant": return participant(int);
    }
  }
});

module.exports = Module;