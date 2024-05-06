const Augur = require("augurbot-ts"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  // eliteAPI = require('../utils/EliteApi'),
  // axios = require('axios'),
  discord = require('discord.js'),
  // moment = require('moment'),
  perms = require('../utils/perms'),
  // chessAPI = new (require('chess-web-api'))({ queue: true }),
  u = require("../utils/utils"),
  config = require('../config/config.json');

/** @type {discord.Collection<string, {id: string, game: string}>} */
let gameDefaults = new u.Collection();

const Module = new Augur.Module();

/** @param {discord.CommandInteraction} inter */
async function slashGameDestiny(inter) {
  const setClan = async () => {
    return inter.reply({ content: `Clan feature not currently available.`, ephemeral: true });
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
    if (!perms.isDestinyAdmin(inter.member) && !inter.member.roles.cache.hasAny([u.sf.roles.destinyclansmanager, u.sf.roles.destinyvaliantadmin])) {
      return inter.reply({ content: `Only <@&${u.sf.roles.destinyvaliantadmin}> and above can use this command.`, ephemeral: true });
    }
    const user = inter.options.getMember('user');
    const remove = inter.options.getBoolean('remove') ?? false;
    try {
      const has = user.roles.cache.has(u.sf.roles.destinyvaliant);
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
      // case "chess": return slashGameChess(inter);
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
    const channels = await doc.sheetsByTitle["WIP Channel Defaults"].getRows();
    gameDefaults = new u.Collection(channels.map(x => [x["ChannelId"], { id: x["ChannelId"], game: x["Game Name"] }]));
  } catch (e) { u.errorHandler(e, "Load Game Channel Info"); }
});

module.exports = Module;
