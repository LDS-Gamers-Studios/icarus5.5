// @ts-check
const Augur = require("augurbot-ts"),
  eliteAPI = require('../utils/EliteApi'),
  axios = require('axios'),
  Discord = require('discord.js'),
  u = require("../utils/utils");


const Module = new Augur.Module();

/**
 * Send the image as an embed
 * @param {Discord.ChatInputCommandInteraction} int
 * @param {Buffer | String} img
 * @param {String} name
 * @param {String} format
 * @returns {Promise<any>}
 */
async function sendImg(int, img, name, format = "png") {
  const image = u.attachment().setFile(img).setName(`image.${format}`);
  const embed = u.embed().setTitle(name).setImage(`attachment://image.${format}`);
  return int.reply({ embeds: [embed], files: [image] });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashGameMinecraftSkin(int) {
  // await inter.deferReply();
  const user = int.options.getMember('user') ?? int.user;
  const name = int.options.getString('username') || (await u.db.ign.find(user?.id, 'minecraft'))?.ign;
  if (!name) return int.reply({ content: `${user} has not saved an IGN for Minecraft`, ephemeral: true });
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)',
      'Accept-Encoding': 'gzip, deflate',
      'Accept': '*/*',
      'Connection': 'keep-alive',
      'content-type': 'image/png',
    };
    const uuid = (await axios.get(`https://api.mojang.com/users/profiles/minecraft/${name}`, { headers }))?.data;
    if (!uuid?.id) return int.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
    const skinUrl = `https://visage.surgeplay.com/full/512/${uuid.id}.png`;
    const result = await axios.get(`${skinUrl}`, { headers, responseType: 'arraybuffer' });
    if (result.status === 200) {
      return sendImg(int, Buffer.from(result.data, 'binary'), "minecraft_skin.png", "png");
    }
    return int.reply({ content: "An error occurred obtaining the skin for that player." });
  } catch (error) {
    return int.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
  }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} int
 * @param {string} game
 */
function currentPlayers(int, game) {
  const players = int.guild.members.cache.map(m => {
    if (m.user.bot) return null;
    const presence = m.presence?.activities?.find(a => a.type === Discord.ActivityType.Playing && a.name.toLowerCase().startsWith(game.toLowerCase()));
    return presence ? `• ${m}` : null;
  }).filter(p => p !== null).sort((a, b) => a.localeCompare(b));
  return u.embed().setTitle(`${int.guild.name} members currently playing ${game}`).setDescription(players.length > 0 ? players.join('\n') : `I couldn't find any members playing ${game}`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameGetPlaying(inter) {
  const game = inter.options.getString("game") ?? u.db.sheets.wipChannels.get(inter.channelId)?.name;
  if (game) return inter.reply({ embeds: [currentPlayers(inter, game)], ephemeral: true });
  // List *all* games played
  const games = new u.Collection();
  for (const [, member] of inter.guild.members.cache) {
    if (member.user.bot) continue;
    const playing = member.presence?.activities?.find(a => a.type === Discord.ActivityType.Playing);
    if (playing && !games.has(playing.name)) games.set(playing.name, { game: playing.name, players: 0 });
    if (playing) games.get(playing.name).players++;
  }

  const gameList = games.sort((a, b) => {
    if (b.players === a.players) return a.game.localeCompare(b.game);
    return b.players - a.players;
  }).toJSON();
  const s = gameList.length > 0 ? 's' : '';
  const embed = u.embed().setTimestamp()
    .setTitle(`Currently played game${s} in ${inter.guild.name}`)
    .setDescription(`The top ${Math.min(gameList.length, 25)} game${s} currently being played in ${inter.guild.name}:`);
  if (gameList.length > 0) gameList.map((g, i) => i < 25 ? embed.addFields({ name: g.game, value: `${g.players}` }) : null);
  else embed.setDescription("Well, this is awkward ... Nobody is playing anything.");
  inter.reply({ embeds: [embed], ephemeral: true });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashGameElite(int) {
  const system = int.options.getString("system-name") || "LDS 2314";
  const info = int.options.getString('info', true);

  if (info === "time") return int.reply(eliteGetTime());

  await int.deferReply({ ephemeral: int.channelId !== u.sf.channels.elite });
  if (info === "status") return int.reply(await eliteGetStatus());

  const starSystem = await eliteAPI.getSystemInfo(system);
  if (!starSystem) return int.editReply({ content: "I couldn't find a system with that name." }).then(u.clean);

  let reply;
  const embed = u.embed().setThumbnail("https://i.imgur.com/Ud8MOzY.png").setAuthor({ name: "EDSM", iconURL: "https://i.imgur.com/4NsBfKl.png" });
  switch (info) {
    case "bodies": reply = await eliteGetBodies(starSystem, embed); break;
    case "factions": reply = await eliteGetFactions(starSystem, embed); break;
    case "stations": reply = await eliteGetStations(starSystem, embed); break;
    case "system": reply = await eliteGetSystem(starSystem, embed) ; break;
    default: throw new Error("Unhandled Option - Games/Elite");
  }
  return int.editReply(reply);
}

async function eliteGetStatus() {
  const status = await eliteAPI.getEliteStatus();
  return { content: `The Elite: Dangerous servers are ${status.type === 'success' ? "online" : "offline"}`, ephemeral: true };
}

function eliteGetTime() {
  const d = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return { content: `The current date/time in Elite is ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${(d.getUTCFullYear() + 1286)}, ${d.getUTCHours()}:${d.getUTCMinutes()}. (UTC + 1286 years)`, ephemeral: true };
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
  if (system.stations.length <= 0) return { content: "I couldn't find any stations in that system.", ephemeral: true };
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
  if (system.factions.length < 1) return { content: "I couldn't find any factions in that system.", ephemeral: true };
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
  if (system.bodies.length < 1) return { content: "I couldn't find any bodies in that system.", ephemeral: true };
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
});

module.exports = Module;
