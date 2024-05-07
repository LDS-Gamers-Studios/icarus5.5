// @ts-check
const Augur = require("augurbot-ts"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  // eliteAPI = require('../utils/EliteApi'),
  // axios = require('axios'),
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
    // console.log()
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
      // case "elite": return slashGameElite(inter);
      // case "minecraft-skin": return slashGameMinecraftSkin(inter);
      // case "playing": return slashGameGetPlaying(inter);
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
