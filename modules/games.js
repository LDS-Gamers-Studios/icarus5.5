// @ts-check
const Augur = require("augurbot-ts"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  eliteAPI = require('../utils/EliteApi'),
  axios = require('axios'),
  discord = require('discord.js'),
  moment = require('moment'),
  perms = require('../utils/perms'),
  chessAPI = new (require('chess-web-api'))({ queue: true }),
  u = require("../utils/utils"),
  config = require('../config/config.json');

/** @type {discord.Collection<string, {id: string, game: string}>} */
let gameDefaults = new u.Collection();

const Module = new Augur.Module();

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashGameChess(interaction) {
  const user = interaction.options.getMember('user');
  let name = interaction.options.getString('username');
  if (user) name = (await u.db.ign.find(user.id, 'chess'))?.ign;
  else if (!name) name = (await u.db.ign.find(interaction.user.id, 'chess'))?.ign;
  if (name) {
    try {
      let result = await chessAPI.getPlayerCurrentDailyChess(encodeURIComponent(name));
      const games = result.body.games;
      const getPlayer = /https:\/\/api\.chess\.com\/pub\/player\/(.*)$/;
      const embed = u.embed().setTitle(`Current Chess.com Games for ${name}`)
        .setThumbnail("https://openclipart.org/image/800px/svg_to_png/275248/1_REY_Blanco_Pieza-Mural_.png");
      let i = 0;
      for (const game of games) {
        const white = getPlayer.exec(game.white);
        const black = getPlayer.exec(game.black);
        const turn = getPlayer.exec(game[game.turn]);
        embed.addFields(
          {
            name: `♙${white ? white[1] : "Unknown Player"} v ♟${black ? black[1] : "Unknown Player"}`,
            value: `Current Turn: ${(game.turn == "white" ? "♙" : "♟")}${turn ? turn[1] : "?"}\nMove By: ${moment(game.move_by).format("ddd h:mmA Z")}\n[[link]](${game.url})`
          });
        if (++i == 25) break;
      }
      if (games.length == 0) {
        result = await chessAPI.getPlayerStats(encodeURIComponent(name));
        if (result) {
          const daily = result.body["chess_daily"];
          const tactics = result.body["tactics"];
          const puzzle = result.body["puzzle_rush"]?.best;
          const toTime = (time) => `<t:${time}:F>`;
          const overall = daily?.record ? `Overall:\nWins: ${daily.record.win}\nLosses: ${daily.record.loss}\nDraws: ${daily.record.draw}\nTime Per Move: ${daily.record['time_per_move']}\n\n` : "";
          const latest = daily?.last ? `Latest:\nRating: ${daily.last.rating}\nDate: ${toTime(daily.last.date)}\n\n` : "";
          const best = daily?.best ? `Best:\nRating: ${daily.best.rating}\nDate: ${toTime(daily.best.date)}\n[Link](${daily.best.game})` : "";
          embed.setTitle(`Chess.com Stats for ${name}`)
            .addFields(
              { name: "Chess Daily", value: (overall || latest || best) ? `${overall}${latest}${best}` : "No available stats" },
              { name: "Puzzle Rush", value: puzzle ? `Total Attempts: ${puzzle["total_attempts"]}\nHigh Score: ${puzzle.score}` : "No available stats" },
              { name: "Tactics", value: tactics ? `Highest Rating: ${tactics.highest.rating}\nLowest Rating: ${tactics.lowest.rating}` : "No available stats" }
            );
          return interaction.reply({ embeds: [embed] });
        }
      }
      if (games.length == 0) embed.setDescription(`No active games found for ${name}`);
      if (games.length > 25) embed.setDescription(`${name}'s first 25 active games:`);
      else embed.setDescription(`${name}'s active games:`);
      interaction.reply({ embeds: [embed] });
    } catch (error) {
      if (error.message == "Not Found" && error.statusCode == 404) {
        interaction.reply({ content: `I couldn't find a profile for \`${name}\`.`, ephemeral: true });
      } else { u.errorHandler(error, interaction); }
    }
  } else {
    interaction.reply({ content: "I couldn't find a saved IGN for them.", ephemeral: true });
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameDestiny(inter) {
  const setClan = async () => {
    return inter.reply({ content: `Clan feature not currently available.`, ephemeral: true });
    // NOTE: Channels this code references don't exist anymore. There is currently
    //  a rework of the Destiny clans happening, so only partially implementing the features.
    // if (!perms.isAdmin(inter) && !inter.member.roles.cache.hasAny([sf.roles.destinyclansadmin, sf.roles.destinyclansmanager])) return inter.reply({ content: `Only <@&${sf.roles.destinyclansadmin}> and above can use this command!`, ephemeral: true });
    // const user = inter.options.getMember('user');
    // const clan = inter.options.getString('clan');
    // const remove = inter.options.getBoolean('remove') ?? false;
    // if (!clan && !remove) return inter.reply({ content: `I need a clan to ${remove ? "remove them from" : "add them to!"}`, ephemeral: true });
    // try {
    //   if (!remove) {
    //     const channel = inter.guild.channels.cache.get(sf.channels.destiny[clan]);
    //     const has = channel.permissionOverwrites.cache.has(user.id);
    //     if (!channel) return inter.reply({ content: "sorry, I couldn't fetch the right channel. Try again in a bit?", ephemeral: true });
    //     if (has) return inter.reply({ content: `${user} is already in that clan!`, ephemeral: true });
    //     await channel.permissionOverwrites.create(user, { "VIEW_CHANNEL": true });
    //     await channel.send(`Welcome to the clan, ${user}!`);
    //     return inter.reply({ content: `Added ${user} to the ${clan} clan!`, ephemeral: true });
    //   } else {
    //     const removed = [];
    //     if (clan) {
    //       const channel = inter.guild.channels.cache.get(sf.channels.destiny[clan]);
    //       const has = channel.permissionOverwrites.cache.has(user.id);
    //       if (!channel) return inter.reply({ content: "sorry, I couldn't fetch the right channel. Try again in a bit?", ephemeral: true });
    //       if (!has) return inter.reply({ content: `${user} isn't in that clan!`, ephemeral: true });
    //       await channel.permissionOverwrites.delete(user);
    //       removed.push(channel.toString());
    //     } else {
    //       for (const id in sf.channels.destiny) {
    //         const channel = inter.guild.channels.cache.get(sf.channels.destiny[id]);
    //         if (channel?.permissionOverwrites.cache.has(user.id)) {
    //           await channel.permissionOverwrites.delete(user);
    //           removed.push(channel.toString());
    //         }
    //       }
    //     }
    //     if (removed.length == 0) return inter.reply({ content: `${user} isn't in a clan!`, ephemeral: true });
    //     return inter.reply({ content: `Removed ${user} from the ${removed.join(', ')} clan(s).`, ephemeral: true });
    //   }
    // } catch (error) {
    //   u.errorHandler(error, inter);
    // }
  };
  const setValiant = async () => {
    if (!perms.isDestinyAdmin(inter.member) && !perms.isDestinyManager(inter.member) && !perms.isDestinyValiantAdmin(inter.member)) {
      return inter.reply({ content: `Only <@&${u.sf.roles.destinyvaliantadmin}> and above can use this command.`, ephemeral: true });
    }
    const user = inter.options.getMember('user');
    const remove = inter.options.getBoolean('remove') ?? false;
    try {
      const has = user?.roles.cache.has(u.sf.roles.destinyvaliant);
      if (!user) return inter.reply({ content: "Invalid user." });
      if ((has && !remove) || (!has && remove)) return inter.reply({ content: `${user} ${remove ? "doesn't have the role yet." : "already has the role."}`, ephemeral: true });
      await user.roles[remove ? "remove" : "add"](u.sf.roles.destinyvaliant);
      return inter.reply({ content: `${user} was ${remove ? "removed from" : "added to"} the <@&${u.sf.roles.destinyvaliant}> role`, ephemeral: true });
    } catch (error) {
      u.errorHandler(error, inter);
    }
  };
  switch (inter.options.getString('action')) {
  case "clan": return setClan();
  case "valiant": return setValiant();
  }
}

/**
 * Send the image as an embed
 * @param {discord.ChatInputCommandInteraction} int
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

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameMinecraftSkin(inter) {
  // await inter.deferReply();
  const user = inter.options.getMember('user') ?? inter.user;
  const name = inter.options.getString('username') || (await u.db.ign.find(user?.id, 'minecraft'))?.ign;
  if (!name) return inter.reply({ content: `${user} has not saved an IGN for Minecraft`, ephemeral: true });
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)',
      'Accept-Encoding': 'gzip, deflate',
      'Accept': '*/*',
      'Connection': 'keep-alive',
      'content-type': 'image/png',
    };
    const uuid = (await axios.get(`https://api.mojang.com/users/profiles/minecraft/${name}`, { headers }))?.data;
    if (!uuid?.id) return inter.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
    const skinUrl = `https://visage.surgeplay.com/full/512/${uuid.id}.png`;
    const result = await axios.get(`${skinUrl}`, { headers, responseType: 'arraybuffer' });
    if (result.status == 200) {
      return sendImg(inter, Buffer.from(result.data, 'binary'), "minecraft_skin.png", "png");
    } else {
      return inter.reply({ content: "An error occurred obtaining the skin for that player." });
    }
  } catch (error) {
    return inter.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
  }
}

/**
 * @param {Augur.GuildInteraction<"CommandSlash">} inter
 * @param {string} game
 */
function currentPlayers(inter, game) {
  const players = inter.guild.members.cache.map(m => {
    if (m.user.bot) return null;
    const presence = m.presence?.activities?.find(a => a.type == discord.ActivityType.Playing && a.name.toLowerCase().startsWith(game.toLowerCase()));
    return presence ? `• ${m}` : null;
  }).filter(p => p != null).sort((a, b) => a.localeCompare(b));
  return u.embed().setTitle(`${inter.guild.name} members currently playing ${game}`).setDescription(players.length > 0 ? players.join('\n') : `I couldn't find any members playing ${game}`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameGetPlaying(inter) {
  const game = inter.options.getString("game") ?? gameDefaults.get(inter.channel?.id)?.game;
  if (game) return inter.reply({ embeds: [currentPlayers(inter, game)], ephemeral: true });
  // List *all* games played
  const games = new u.Collection();
  for (const [, member] of inter.guild.members.cache) {
    if (member.user.bot) continue;
    const playing = member.presence?.activities?.find(a => a.type == discord.ActivityType.Playing);
    if (playing && !games.has(playing.name)) games.set(playing.name, { game: playing.name, players: 0 });
    if (playing) games.get(playing.name).players++;
  }

  const gameList = games.sort((a, b) => {
    if (b.players == a.players) return a.game.localeCompare(b.game);
    else return b.players - a.players;
  }).toJSON();
  const s = gameList.length > 0 ? 's' : '';
  const embed = u.embed().setTimestamp()
    .setTitle(`Currently played game${s} in ${inter.guild.name}`)
    .setDescription(`The top ${Math.min(gameList.length, 25)} game${s} currently being played in ${inter.guild.name}:`);
  if (gameList.length > 0) gameList.map((g, i) => i < 25 ? embed.addFields({ name: g.game, value: `${g.players}` }) : null);
  else embed.setDescription("Well, this is awkward ... Nobody is playing anything.");
  inter.reply({ embeds: [embed], ephemeral: true });
}

/** @param {Augur.GuildInteraction<"CommandSlash">} inter */
async function slashGameElite(inter) {
  const starSystem = inter.options.getString('system-name') ? await eliteAPI.getSystemInfo(inter.options.getString('system-name')) : null;
  const embed = u.embed().setThumbnail("https://i.imgur.com/Ud8MOzY.png").setAuthor({ name: "EDSM", iconURL: "https://i.imgur.com/4NsBfKl.png" });
  const info = inter.options.getString('info');
  let reply;
  if (info && !['status', 'time'].includes(info) && !starSystem) {
    if (!inter.options.getString('system-name')) reply = "You need to give me a system name to look up.";
    else reply = "I couldn't find a system with that name.";
    return inter.reply({ content: reply, ephemeral: true });
  }

  switch (info) {
  case "status": return inter.reply( await eliteGetStatus() ); break;
  case "time": return inter.reply( eliteGetTime() ); break;
  case "bodies": reply = await eliteGetBodies(starSystem, embed); break;
  case "factions": reply = await eliteGetFactions(starSystem, embed); break;
  case "stations": reply = await eliteGetStations(starSystem, embed); break;
  case "system": return inter.reply( await eliteGetSystem(starSystem, embed) ); break;
  }
  return inter.reply(reply);
}

async function eliteGetStatus() {
  const status = await eliteAPI.getEliteStatus();
  return { content: `The Elite: Dangerous servers are ${status.type == 'success' ? "online" : "offline"}`, ephemeral: true };
}

function eliteGetTime() {
  const d = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return { content: `The current date/time in Elite is ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${(d.getUTCFullYear() + 1286)}, ${d.getUTCHours()}:${d.getUTCMinutes()}. (UTC + 1286 years)`, ephemeral: true };
}

/**
 * @param {string} system
 * @param {discord.EmbedBuilder} embed
 */
async function eliteGetSystem(system, embed) {
  embed.setTitle(system.name)
    .setURL(`https://www.edsm.net/en/system/id/${system.id}/name`)
    .addFields({
      name: 'Permit Required?', 
      value: system.requirePermit ? "Yes" : "No", true
    });
  if (system.primaryStar)embed.addField("Star Scoopable", system.primaryStar.isScoopable ? "Yes" : "No", true);

  if (system.information) {
    embed.addField("Controlling Faction", system.information.faction, true)
      .addField("Government Type", system.information.allegiance + " - " + system.information.government, true);
  } else {
    embed.addField("Uninhabited System", "No faction information available.", true);
  }
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetStations(system, embed) {
  if (system.stations.length <= 0) return { content: "I couldn't find any stations in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.stationsURL);

  const stationList = new Map();
  for (let i = 0; i < Math.min(system.stations.length, 25); i++) {
    const station = system.stations[i];
    // Filtering out fleet carriers. There can be over 100 of them (spam) and their names are user-determined (not always clean).
    if (!["Fleet Carrier", "Unknown"].includes(station.type)) {
      if (!stationList.has(station.type)) stationList.set(station.type, []);
      stationList.get(station.type).push(station);
    }
  }

  for (const [stationType, stations] of stationList) {
    embed.addField(stationType, "-----------------------------");
    for (const station of stations) {
      const stationURL = `https://www.edsm.net/en/system/stations/id/starSystem.id/name/${system.name}/details/idS/${station.id}/`;
      let faction = "No Faction";
      const distance = Math.round(station.distanceToArrival * 10) / 10;
      if (station.controllingFaction) {
        faction = station.controllingFaction.name;
      }
      embed.addField(faction, "[" + station.name + "](" + encodeURI(stationURL) + ")\n" + distance + " ls", true);
    }
  }

  // Letting the user know there were more than 25
  if (stationList.size > 25) embed.setFooter({ text: "Some stations were filtered out because the limit was exceeded.", iconURL: "https://i.imgur.com/vYPj8iX.png" });
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetFactions(system, embed) {
  if (system.factions.length < 1) return { content: "I couldn't find any factions in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.factionsURL);

  for (const faction of system.factions) {
    const influence = Math.round(faction.influence * 10000) / 100;
    const url = encodeURI(`https://www.edsm.net/en/faction/id/${faction.id}/name/`);
    embed.addField(faction.name + (system.information && (faction.name === system.information.faction) ? " (Controlling)" : "") + " " + influence + "%",
      "State: " + faction.state + "\nGovernment: " + faction.allegiance + " - " + faction.government + "\n[Link](" + url + ")", true);
  }
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetBodies(system, embed) {
  if (system.bodies.length < 1) return { content: "I couldn't find any bodies in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.bodiesURL);

  for (const body of system.bodies) {
    const scoopable = body.type === "Star" ? (body.isScoopable ? " (Scoopable)" : " (Not Scoopable)") : "";
    const distance = Math.round(body.distanceToArrival * 10) / 10;
    embed.addField(body.name, body.type + scoopable + "\n" + distance + " ls", true);
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
      case "chess": return slashGameChess(interaction);
      case "destiny": return slashGameDestiny(interaction);
      case "elite": return slashGameElite(interaction);
      case "minecraft-skin": return slashGameMinecraftSkin(interaction);
      case "playing": return slashGameGetPlaying(interaction);
      default:
        u.errorHandler(Error("Unknown interaction command."), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
})
.setInit(async () => {
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-ignore
    const channels = await doc.sheetsByTitle["WIP Channel Defaults"].getRows();
    gameDefaults = new u.Collection(channels.map(x => [x["ChannelId"], { id: x["ChannelId"], game: x["Game Name"] }]));
  } catch (e) { u.errorHandler(e, "Load Game Channel Info"); }
});

module.exports = Module;
