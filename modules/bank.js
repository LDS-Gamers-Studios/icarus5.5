// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  config = require("../config/config.json"),
  { customAlphabet } = require("nanoid");
const { makeDocument } = require("../database/sheets");
const { GoogleSpreadsheetRow } = require("google-spreadsheet");

const Module = new Augur.Module(),
  gb = `<:gb:${u.sf.emoji.gb}>`,
  ember = `<:ember:${u.sf.emoji.ember}>`,
  limit = { gb: 1000, ember: 10000 };

const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoid = customAlphabet(chars, 8);

let steamGameList = [];

/**
 * @typedef GameProps
 * @prop {string} Title
 * @prop {string} System
 * @prop {string} Rating
 * @prop {string} Cost
 * @prop {string} Recipient
 * @prop {string} Code
 * @prop {string} Key
 * @prop {string} Date
 *
 * @typedef {GoogleSpreadsheetRow<GameProps>} Game
 */

/** @type {Game[]} */
let games = [];

/**
 * Get unique games
 * @param {Game} game
 * @param {number} i
 * @param {Game[]} gameList
 * @returns {boolean}
 */
function filterUnique(game, i, gameList) {
  const ga = gameList.find(g => g.get("Title") === game.get("Title") && g.get("System") === game.get("System"));
  if (ga) return gameList.indexOf(ga) === i;
  return false;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankGive(interaction) {
  try {
    const giver = interaction.member;
    const recipient = interaction.options.getMember("user");
    const currency = interaction.options.getString("currency", true);
    const { coin, MAX } = (currency === "gb" ? { coin: gb, MAX: limit.gb } : { coin: ember, MAX: limit.ember });

    const value = Math.min(MAX, interaction.options.getInteger("amount", true));
    let reason = interaction.options.getString("reason");

    const toIcarus = recipient?.id === interaction.client.user.id;
    let reply = "";

    if (!recipient) {
      return interaction.reply({ content: "You can't give to ***nobody***, silly.", ephemeral: true });
    } else if (recipient?.id === giver.id) {
      reply = "You can't give to ***yourself***, silly.";
    } else if (toIcarus && currency === "gb") {
      reply = `I don't need any ${coin}! Keep em for yourself.`;
    } else if (!toIcarus && recipient?.user.bot) {
      reply = `Bots don't really have a use for ${coin}.`;
    } else if (toIcarus && (!reason || reason.length === 0)) {
      reply = `You need to have a reason to give ${coin} to me!`;
    } else if (value === 0) {
      reply = "You can't give ***nothing***.";
    } else if (value < 0) {
      reply = `One does not simply ***take*** ${coin}, silly.`;
    }

    if (reply) return interaction.reply({ content: reply, ephemeral: true });

    reason ??= "No particular reason";

    const account = await u.db.bank.getBalance(giver.id);
    if (value > account[currency]) {
      return interaction.reply({ content: `You don't have enough ${coin} to give! You can give up to ${coin}${account[currency]}`, ephemeral: true });
    }

    if (!toIcarus) {
      const deposit = {
        currency,
        discordId: recipient.id,
        description: `From ${giver.displayName}: ${reason}`,
        value,
        giver: giver.id,
        hp: false
      };
      const receipt = await u.db.bank.addCurrency(deposit);
      const balance = await u.db.bank.getBalance(recipient.id);
      const embed = u.embed({ author: interaction.client.user })
        .addFields(
          { name: "Reason", value: reason },
          { name: "Your New Balance", value: `${gb}${balance.gb}\n${ember}${balance.em}` }
        )
        .setDescription(`${u.escapeText(giver.toString())} just gave you ${coin}${receipt.value}.`);
      recipient.send({ embeds: [embed] }).catch(u.noop);
    }
    await interaction.reply(`${coin}${value} sent to ${u.escapeText(recipient.displayName)} for: ${reason}`);
    u.clean(interaction);

    const withdrawal = {
      currency,
      discordId: giver.id,
      description: `To ${recipient.displayName}: ${reason}`,
      value: -value,
      giver: giver.id,
      hp: false
    };
    const receipt = await u.db.bank.addCurrency(withdrawal);
    const balance = await u.db.bank.getBalance(giver.id);
    const embed = u.embed({ author: interaction.client.user })
      .addFields(
        { name: "Reason", value: reason },
        { name: "Your New Balance", value: `${gb}${balance.gb}\n${ember}${balance.em}` }
      )
      .setDescription(`You just gave ${coin}${-receipt.value} to ${u.escapeText(recipient.displayName)}.`);
    giver.send({ embeds: [embed] }).catch(u.noop);

    if (toIcarus) {
      const hoh = interaction.client.getTextChannel(u.sf.channels.logistics);
      const hohEmbed = u.embed({ author: giver })
        .setDescription(`**${u.escapeText(giver.displayName)}** gave me ${coin}${value}.`)
        .addFields({ name: "Reason", value: reason });
      hoh?.send({ embeds: [hohEmbed] });
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankBalance(interaction) {
  try {
    const member = interaction.member;
    const balance = await u.db.bank.getBalance(member.id);
    const embed = u.embed({ author: member })
      .setDescription(`${gb}${balance.gb}\n${ember}${balance.em}`);
    interaction.reply({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankGameList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!games) throw new Error("Games List Error");
    for (const game of games.filter(g => !g.get("Code"))) {
      game.set("Code", nanoid());
      game.save();
    }

    let gameList = games.sort((a, b) => a.get("Title").localeCompare(b.get("Title")));
    // Filter Rated M, unless the member has the Rated M Role
    if (!interaction.member.roles.cache.has(u.sf.roles.rated_m)) gameList = gameList.filter(g => g.get("Rating").toUpperCase() !== "M" && !g.get("Recipient"));

    const embed = u.embed()
      .setTitle("Games Available to Redeem")
      .setDescription(`Redeem ${gb} for game codes with the </bank game redeem:${u.sf.commands.slashBank}> command.\n\n`);
    u.pagedEmbeds(interaction, embed, gameList.map(game => {
      let steamApp = null;
      if (game.get("System")?.toLowerCase() === "steam") {
        steamApp = steamGameList.find(g => g.name.toLowerCase() === game.get("Title")?.toLowerCase());
      }
      return `${steamApp ? "[" : ""}**${game.get("Title")}** (${game.get("System")})${steamApp ? `](https://store.steampowered.com/app/${steamApp.appid})` : ""}`
        + ` Rated ${game.get("Rating") ?? ""} - ${gb}${game.get("Cost")} | Code: **${game.get("Code")}**\n`;
    }));
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankGameRedeem(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    if (!games) throw new Error("Get Game List Error");
    const rawGame = games.find(g => (g.get("Code") === interaction.options.getString("code", true).toUpperCase()) && !g.get("Recipient"));
    if (!rawGame) {
      return interaction.editReply(`I couldn't find that game. Use </bank game list:${u.sf.commands.slashBank}> to see available games.`);
    }
    const game = {
      code: rawGame.get("Code"),
      cost: rawGame.get("Cost"),
      title: rawGame.get("Title"),
      system: rawGame.get("System")
    };

    const systems = {
      steam: {
        redeem: "https://store.steampowered.com/account/registerkey?key=",
        img: `https://cdn.discordapp.com/emojis/${u.sf.emoji.steam}.png`
      }
    };

    const balance = await u.db.bank.getBalance(interaction.user.id);
    if (balance.gb < parseFloat(game.cost)) {
      return interaction.editReply(`You don't currently have enough ${gb}. Sorry!`);
    }

    await u.db.bank.addCurrency({
      currency: "gb",
      discordId: interaction.user.id,
      description: `${game.title} (${game.system}) Game Key`,
      value: -1 * parseInt(game.cost),
      giver: interaction.user.id,
      hp: false
    });

    let embed = u.embed()
      .setTitle("Game Code Redemption")
      .setDescription(`You just redeemed a key for:\n${game.title} (${game.system})`)
      .addFields(
        { name: "Cost", value: gb + game.cost, inline: true },
        { name: "Balance", value: `${gb}${balance.gb - parseInt(game.cost)}`, inline: true },
        { name: "Game Key", value: game.key ?? "Unknown" }
      );

    if (systems[game.system?.toLowerCase()]) {
      const sys = systems[game.system.toLowerCase()];
      embed.setURL(sys.redeem + game.key)
        .addFields({ name: "Key Redemption Link", value: `[Redeem key here](${sys.redeem + game.key})` })
        .setThumbnail(sys.img);
    }

    rawGame.set("Recipient", interaction.user.username);
    rawGame.set("Date", new Date().toDateString());
    rawGame.save();
    await interaction.editReply({ content: "I also DMed this message to you so you don't lose the code!", embeds: [embed] });
    interaction.user.send({ embeds: [embed] }).catch(() => {
      interaction.followUp({ content: "I wasn't able to send you the game key! Do you have DMs allowed for server members? Please note down your game key somewhere safe, and check with a member of Management if you lose it.", ephemeral: true });
    });

    embed = u.embed({ author: interaction.member })
      .setDescription(`${interaction.user.username} just redeemed ${gb} for a ${game.title} (${game.system}) key.`)
      .addFields(
        { name: "Cost", value: gb + game.cost, inline: true },
        { name: "Balance", value: `${gb}${balance.gb - parseInt(game.cost)}`, inline: true }
      );
    interaction.client.getTextChannel(u.sf.channels.logistics)?.send({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankDiscount(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger("amount", true);
    const balance = await u.db.bank.getBalance(interaction.user.id);
    if ((amount > balance.gb) || (amount < 0) || (amount > limit.gb)) {
      return interaction.editReply(`That amount (${gb}${amount}) is invalid. You can currently redeem up to ${gb}${Math.min(balance.gb, limit.gb)}.`);
    }

    if (!config.api.snipcart) return interaction.editReply("Store discounts are currently unavailable. Sorry for the inconvenience. We're working on it!");
    const snipcart = require("../utils/snipcart")(config.api.snipcart);
    const discountInfo = {
      name: `${interaction.user.username} ${Date().toLocaleString()}`,
      combinable: false,
      maxNumberOfUsages: 1,
      trigger: "Code",
      code: nanoid(),
      type: "FixedAmount",
      amount: (amount / 100)
    };

    const discount = await snipcart.newDiscount(discountInfo);

    if (discount.amount && discount.code) {
      const withdrawal = {
        currency: "gb",
        discordId: interaction.user.id,
        description: "LDSG Store Discount Code",
        value: -amount,
        giver: interaction.user.id,
        hp: false
      };
      const withdraw = await u.db.bank.addCurrency(withdrawal);
      const recieptMessage = `You have redeemed ${gb}${withdraw.value} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\nUse code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\nYou now have ${gb}${balance.gb + withdraw.value}.`;
      await interaction.editReply(recieptMessage + "\nI also DMed this message to you so you don't lose the code!");
      interaction.user.send(recieptMessage)
      .catch(() => {
        interaction.followUp({ content: "I wasn't able to send you the code! Do you have DMs allowed for server members? Please copy down your code somewhere safe ASAP. Please check with a member of Management if you lose your discount code.", ephemeral: true });
      });
      const embed = u.embed({ author: interaction.member })
        .addFields(
          { name: "Amount", value:  `${gb}${-withdraw.value} ($${-withdraw.value / 100})` },
          { name: "Balance", value: `${gb}${balance.gb + withdraw.value}` }
        )
        .setDescription(`**${u.escapeText(interaction.member.displayName)}** just redeemed ${gb} for a store coupon code.`);
      interaction.client.getTextChannel(u.sf.channels.logistics)?.send({ embeds: [embed] });
    } else {
      interaction.editReply("Sorry, something went wrong. Please try again.");
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

Module.addInteraction({ name: "bank",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashBank,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
      case "give": return slashBankGive(interaction);
      case "balance": return slashBankBalance(interaction);
      case "list": return slashBankGameList(interaction);
      case "redeem": return slashBankGameRedeem(interaction);
      case "discount": return slashBankDiscount(interaction);
      // case "award": located in team.js
      default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
    }
  }
})
.setInit(async function(gl) {
  try {
    // Get redeemable games list
    const doc = makeDocument(config.google.sheets.games);
    await doc.loadInfo();
    // @ts-ignore sheets stuff
    const rows = await doc.sheetsByIndex[0].getRows();
    games = rows.filter(g => !g.get("Recipient")).filter(filterUnique);

    if (gl) {
      steamGameList = gl;
    } else {
      const SteamApi = require("steamapi"),
        steam = new SteamApi(config.api.steam);
      steamGameList = await steam.getAppList();
    }
  } catch (e) { u.errorHandler(e, "Fetch Steam Game List Error"); }
})
.setUnload(() => steamGameList);

module.exports = Module;
module.exports.bankVars = {
  limit,
  gb,
  ember
};