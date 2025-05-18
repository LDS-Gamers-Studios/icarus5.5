// @ts-check
const Augur = require("augurbot-ts"),
  eliteAPI = require('../utils/EliteApi'),
  axios = require('axios'),
  Discord = require('discord.js'),
  u = require("../utils/utils");

const Module = new Augur.Module();

async function updateFactionStatus() {
  const channel = Module.client.getTextChannel(u.sf.channels.elite);
  try {
    const starSystem = await eliteAPI.getSystemInfo("LDS 2314").catch(u.noop);
    if (!starSystem) return;

    const faction = starSystem.factions.find(f => f.name === "LDS Enterprises");
    if (!faction) return;

    const influence = Math.round(faction.influence * 10000) / 100;

    // Discord has a topic size limit of 250 characters, but this will never pass that.
    channel?.setTopic(`[LDS 2314 / LDS Enterprises]  Influence: ${influence}% - State: ${faction.state} - LDS 2314 Controlling Faction: ${starSystem.information?.faction}`);
  } catch (e) { u.errorHandler(e, "Elite Channel Update Error"); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashGameMinecraftSkin(int) {
  await int.deferReply();
  const name = int.options.getString("user") ?? int.user.toString();

  /** @type {string | undefined | Discord.GuildMember} */
  let user = name;
  let findIgn = false;
  if (name) {
    const pingMatch = /<@!?([0-9]+)>/.exec(name);
    if (pingMatch) {
      user = int.guild.members.cache.get(pingMatch[1])?.id; // yes this is on purpose. it's to see if they're in the server
      findIgn = true;
    }
  }

  if (!user) return int.editReply(`You need to mention someone or provide a username when using this command.`);

  // parsed a user id
  if (findIgn) user = (await u.db.ign.findOne(user, 'minecraft'))?.ign;
  if (!user) return int.editReply(`That person hasn't saved an IGN for Minecraft. Try using a username instead.`);

  try {
    // @ts-ignore
    const result = await axios(`https://starlightskins.lunareclipse.studio/render/walking/${user}/full`, { responseType: "arraybuffer" });
    if (result.status === 200) {
      const image = new u.Attachment(Buffer.from(result.data, 'binary'), { name: "image.png" });
      const embed = u.embed().setTitle(user).setImage("attachment://image.png");
      return int.editReply({ embeds: [embed], files: [image] });
    }
    return int.editReply({ content: "An error occurred obtaining the skin for that player." });
  } catch (error) {
    return int.editReply(`I couldn't find the player \`${name}\`.`);
  }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {string} game
 */
function currentPlayers(int, game) {
  const players = int.guild.members.cache.map(m => {
    if (m.user.bot) return "";
    const presence = m.presence?.activities?.find(a => a.type === Discord.ActivityType.Playing && a.name.toLowerCase().startsWith(game.toLowerCase()));
    return presence ? `• ${m}` : "";
  }).filter(p => p !== "").sort((a, b) => a.localeCompare(b));
  return u.embed().setTitle(`${int.guild.name} members currently playing ${game}`).setDescription(players.length > 0 ? players.join('\n') : `I couldn't find any members playing ${game}`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameGetPlaying(inter) {
  const game = inter.options.getString("game") ?? u.db.sheets.wipChannels.get(inter.channelId)?.name;
  if (game) return inter.reply({ embeds: [currentPlayers(inter, game)], flags: ["Ephemeral"] });

  // List *all* games played
  /** @type {Discord.Collection<string, { game: string, players: number }>} */
  const games = new u.Collection();
  for (const [, member] of inter.guild.members.cache) {
    if (member.user.bot) continue;
    const playing = member.presence?.activities?.find(a => a.type === Discord.ActivityType.Playing);
    if (playing) games.ensure(playing.name, () => ({ game: playing.name, players: 0 })).players++;
  }

  games.sort((a, b) => {
    if (b.players === a.players) return a.game.localeCompare(b.game);
    return b.players - a.players;
  });

  const s = games.size !== 1 ? 's' : '';
  const embed = u.embed().setTimestamp()
    .setTitle(`Currently played game${s} in ${inter.guild.name}`)
    .setDescription(`The top ${Math.min(games.size, 25)} game${s} currently being played in ${inter.guild.name}:`)
    .setFields(games.first(25).map(g => ({ name: g.game, value: `${g.players} Player${g.players === 1 ? "" : "s"}` })));

  if (games.size === 0) embed.setDescription("Well, this is awkward ... Nobody is playing anything.");

  inter.reply({ embeds: [embed], flags: ["Ephemeral"] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashGameElite(int) {
  const system = int.options.getString("system-name") || "LDS 2314";
  const info = int.options.getString('info', true);

  if (info === "time") return int.reply(eliteGetTime());

  await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.elite) });
  if (info === "status") return int.editReply(await eliteGetStatus());

  const starSystem = await eliteAPI.getSystemInfo(system);
  if (!starSystem) return int.editReply({ content: "I couldn't find a system with that name." }).then(u.clean);

  /** @type {string | Discord.InteractionEditReplyOptions } */
  let reply;
  const embed = u.embed().setThumbnail("https://i.imgur.com/Ud8MOzY.png").setAuthor({ name: "EDSM", iconURL: "https://i.imgur.com/4NsBfKl.png" });
  switch (info) {
    case "bodies": reply = await eliteGetBodies(starSystem, embed); break;
    case "factions": reply = await eliteGetFactions(starSystem, embed); break;
    case "stations": reply = await eliteGetStations(starSystem, embed); break;
    case "system": reply = await eliteGetSystem(starSystem, embed) ; break;
    default: throw new Error("Unhandled Option - Games/Elite");
  }
  return int.editReply(reply).then(() => {
    if (typeof reply === "string") u.clean(int);
  });
}

async function eliteGetStatus() {
  const status = await eliteAPI.getEliteStatus();
  return `The Elite: Dangerous servers are ${status.type === 'success' ? "online" : "offline"}`;
}
/**
 * @returns {Discord.InteractionReplyOptions}
 */
function eliteGetTime() {
  const d = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return { content: `The current date/time in Elite is ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${(d.getUTCFullYear() + 1286)}, ${d.getUTCHours()}:${d.getUTCMinutes()}. (UTC + 1286 years)`, flags: ["Ephemeral"] };
}

/**
 * @param {eliteAPI.EliteSystem} system
 * @param {Discord.EmbedBuilder} embed
 */
async function eliteGetSystem(system, embed) {
  embed.setTitle(system.name)
    .setURL(`https://www.edsm.net/en/system/id/${system.id}/name`)
    .addFields({
      name: 'Permit Required?',
      value: system.requirePermit ? "Yes" : "No",
      inline: true
    });
  if (system.primaryStar)embed.addFields({ name: "Star Scoopable", value: system.primaryStar.isScoopable ? "Yes" : "No", inline: true });

  if (system.information) {
    embed.addFields(
      { name: "Controlling Faction", value: system.information.faction, inline: true },
      { name: "Government Type", value: `${system.information.allegiance} - ${system.information.government}`, inline: true }
    );
  } else {
    embed.addFields({ name: "Uninhabited System", value: "No faction information available.", inline: true });
  }
  return { embeds: [embed] };
}

/**
 * @param {eliteAPI.EliteSystem} system
 * @param {Discord.EmbedBuilder} embed
 */
async function eliteGetStations(system, embed) {
  if (system.stations.length <= 0) return "I couldn't find any stations in that system.";
  embed.setTitle(system.name).setURL(system.stationsURL);

  /** @type {Discord.Collection<string, eliteAPI.Station[]>} */
  const stationList = new u.Collection();
  for (let i = 0; i < Math.min(system.stations.length, 25); i++) {
    const station = system.stations[i];
    // Filtering out fleet carriers. There can be over 100 of them (spam) and their names are user-determined (not always clean).
    if (!["Fleet Carrier", "Unknown"].includes(station.type)) {
      stationList.ensure(station.type, () => []).push(station);
    }
  }

  for (const [stationType, stations] of stationList) {
    embed.addFields({ name: stationType, value: "-----------------------------" });
    for (const station of stations) {
      const stationURL = `https://www.edsm.net/en/system/stations/id/starSystem.id/name/${system.name}/details/idS/${station.id}/`;
      let faction = "No Faction";
      const distance = Math.round(station.distanceToArrival * 10) / 10;
      if (station.controllingFaction) {
        faction = station.controllingFaction.name;
      }
      embed.addFields({ name: faction, value: `[${station.name}](${encodeURI(stationURL)})\n${distance} ls`, inline: true });
    }
  }

  // Letting the user know there were more than 25
  if (stationList.size > 25) embed.setFooter({ text: "Some stations were filtered out because the limit was exceeded.", iconURL: "https://i.imgur.com/vYPj8iX.png" });
  return { embeds: [embed] };
}

/**
 * @param {eliteAPI.EliteSystem} system
 * @param {Discord.EmbedBuilder} embed
 */
async function eliteGetFactions(system, embed) {
  if (system.factions.length < 1) return "I couldn't find any factions in that system.";
  embed.setTitle(system.name).setURL(system.factionsURL);

  for (const faction of system.factions) {
    const influence = Math.round(faction.influence * 10000) / 100;
    const url = encodeURI(`https://www.edsm.net/en/faction/id/${faction.id}/name/`);
    embed.addFields({
      name: `${faction.name}${(system.information && (faction.name === system.information.faction) ? " (Controlling)" : "")} ${influence}"%"`,
      value: `State: ${faction.state}\nGovernment: ${faction.allegiance} - ${faction.government}\n[Link](${url}")`,
      inline: true
    });
  }
  return { embeds: [embed] };
}

/**
 * @param {eliteAPI.EliteSystem} system
 * @param {Discord.EmbedBuilder} embed
 */
async function eliteGetBodies(system, embed) {
  if (system.bodies.length < 1) return "I couldn't find any bodies in that system.";
  embed.setTitle(system.name).setURL(system.bodiesURL);

  for (const body of system.bodies) {
    const scoopable = body.type === "Star" ? (body.isScoopable ? " (Scoopable)" : " (Not Scoopable)") : "";
    const distance = Math.round(body.distanceToArrival * 10) / 10;
    embed.addFields({ name: body.name, value: `${body.type}${scoopable}\n${distance} ls`, inline: true });
  }
  return { embeds: [embed] };
}

Module.addInteraction({
  name: "game",
  guildId: u.sf.ldsg,
  id: u.sf.commands.slashGame,
  onlyGuild: true,
  process: async (interaction) => {
    try {
      switch (interaction.options.getSubcommand()) {
        case "elite": return slashGameElite(interaction);
        case "minecraft-skin": return slashGameMinecraftSkin(interaction);
        case "playing": return slashGameGetPlaying(interaction);
        default: u.errorHandler(Error("Unknown interaction command."), interaction);
      }
    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
})
.setClockwork(() => {
  return setInterval(() => {
    updateFactionStatus();
    // every 6 hours seems alright
  }, 6 * 60 * 60_000);
});

module.exports = Module;
