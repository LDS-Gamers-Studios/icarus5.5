// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  config = require("../config/config.json"),
  { customAlphabet } = require("nanoid");
const Discord = require("discord.js");

const Module = new Augur.Module(),
  gb = `<:gb:${u.sf.emoji.gb}>`,
  ember = `<:ember:${u.sf.emoji.ember}>`,
  limit = { gb: 1000, ember: 10000 };

const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoid = customAlphabet(chars, 8);

/**
 * @param {ReturnType<import("../database/sheets")["data"]["games"]["available"]["ensure"]>} game
 * @param {Discord.GuildMember} user
 */
async function buyGame(game, user) {
  // get store assets
  /** @type {Record<string, { redeem: string, img: string}>} */
  const systems = {
    steam: {
      redeem: "https://store.steampowered.com/account/registerkey?key=",
      img: `https://cdn.discordapp.com/emojis/${u.sf.emoji.steam}.png`
    }
  };

  const balance = await u.db.bank.getBalance(user.id);
  if (balance.gb < game.cost) return false;

  // make the transaction
  await u.db.bank.addCurrency({
    currency: "gb",
    discordId: user.id,
    description: `${game.title} (${game.system}) Game Key`,
    value: -1 * game.cost,
    otherUser: user.client.user.id,
    hp: false
  });

  const embed1 = u.embed()
    .setTitle("Game Code Redemption")
    .setDescription(`You just redeemed a key for:\n${game.title} (${game.system})`)
    .addFields(
      { name: "Cost", value: gb + game.cost, inline: true },
      { name: "Balance", value: `${gb}${balance.gb - game.cost}`, inline: true },
      { name: "Game Key", value: game.key ?? "Unknown" }
    );

  if (systems[game.system?.toLowerCase()]) {
    const sys = systems[game.system.toLowerCase()];
    embed1.setURL(sys.redeem + game.key)
      .addFields({ name: "Key Redemption Link", value: `[Redeem key here](${sys.redeem + game.key})` })
      .setThumbnail(sys.img);
  }

  u.db.sheets.games.available.delete(game.code);
  await u.db.sheets.games.purchased.update({ ...game, recipient: user.displayName, date: new Date() });

  // sometimes there are multiple games
  const backupGame = u.db.sheets.games.available.rows.find(g => g.get("Title") === game.title && g.get("Code") !== game.code && !g.get("Recipient ID") && !g.get("Date"));
  if (backupGame) u.db.sheets.games.available.set(backupGame.get("Code"), u.db.sheets.games.available.parseRow(backupGame));

  const embed2 = u.embed({ author: user })
    .setDescription(`${user.displayName} just redeemed ${gb}${game.cost} for a ${game.title} (${game.system}) key.`)
    .addFields(
      { name: "Cost", value: gb + game.cost, inline: true },
      { name: "Balance", value: `${gb}${balance.gb - game.cost}`, inline: true }
    );
  user.client.getTextChannel(u.sf.channels.team.logistics)?.send({ embeds: [embed2] });
  return embed1;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankGive(interaction) {
  try {
    const giver = interaction.member;
    const recipient = interaction.options.getMember("user");
    /** @type {"em"|"gb"} */
    // @ts-ignore
    const currency = interaction.options.getString("currency", true);
    const { coin, MAX } = (currency === "gb" ? { coin: gb, MAX: limit.gb } : { coin: ember, MAX: limit.ember });

    const value = Math.min(MAX, interaction.options.getInteger("amount", true));
    let reason = interaction.options.getString("reason");

    const toIcarus = recipient?.id === interaction.client.user.id;
    let reply = "";

    if (!recipient) {
      return interaction.reply({ content: "You can't give to ***nobody***, silly.", flags: ["Ephemeral"] });
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

    if (reply) return interaction.reply({ content: reply, flags: ["Ephemeral"] });

    reason ??= "No particular reason";

    const account = await u.db.bank.getBalance(giver.id);
    if (value > account[currency]) {
      return interaction.reply({ content: `You don't have enough ${coin} to give! You can give up to ${coin}${account[currency]}`, flags: ["Ephemeral"] });
    }

    if (!toIcarus) {
      const deposit = {
        currency,
        discordId: recipient.id,
        description: reason,
        value,
        otherUser: giver.id,
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
      description: reason,
      value: -value,
      otherUser: recipient.id,
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
      const hoh = interaction.client.getTextChannel(u.sf.channels.team.logistics);
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
  await interaction.deferReply({ flags: ["Ephemeral"] });

  try {
    // Filter Rated M, unless the member has the Rated M Role
    let gameList = u.uniqueObj(u.db.sheets.games.available.map(g => g), "title");
    if (!interaction.member.roles.cache.has(u.sf.roles.rated_m)) gameList = gameList.filter(g => g.rating.toUpperCase() !== "M");

    const games = gameList.sort((a, b) => a.title.localeCompare(b.title))
      .map(g => {
        const title = `**${g.title}** (${g.system})`;
        let str = title;

        // link shenanigans
        if (g.steamId) str = `[${title}](https://store.steampowered.com/app/${g.steamId})`;

        str += ` Rated ${g.rating}\n${gb}${g.cost} | Code: **${g.code}**\n`;
        return str;
      });

    const embed = u.embed()
      .setTitle("Games Available to Redeem")
      .setDescription(`Redeem ${gb} for game codes with the </bank game redeem:${u.sf.commands.slashBank}> command.\n\n`);

    const processedEmbeds = u.pagedEmbedsDescription(embed, games).map(e => ({ embeds: [e] }));
    return u.manyReplies(interaction, processedEmbeds, true);
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankGameRedeem(interaction) {
  try {
    await interaction.deferReply({ flags: ["Ephemeral"] });

    // find the game they're trying to redeem
    const code = interaction.options.getString("code", true).toUpperCase();
    const game = u.db.sheets.games.available.get(code);
    if (!game) {
      return interaction.editReply(`I couldn't find that game. Use </bank game list:${u.sf.commands.slashBank}> to see available games.`);
    }

    // buy the game (or fail)
    const embed = await buyGame(game, interaction.member);
    if (!embed) return interaction.editReply(`You don't currently have enough ${gb}. Sorry!`);

    await interaction.editReply({ content: "I also DMed this message to you so you don't lose the code!", embeds: [embed] });
    interaction.user.send({ embeds: [embed] }).catch(() => {
      interaction.followUp({ content: "I wasn't able to send you the game key! Do you have DMs allowed for server members? Please note down your game key somewhere safe, and check with a member of Management if you lose it.", flags: ["Ephemeral"] });
    });

  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankDiscount(interaction) {
  try {
    await interaction.deferReply({ flags: ["Ephemeral"] });
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
        otherUser: interaction.client.user.id,
        hp: false
      };
      const withdraw = await u.db.bank.addCurrency(withdrawal);
      const recieptMessage = `You have redeemed ${gb}${withdraw.value} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\nUse code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\nYou now have ${gb}${balance.gb + withdraw.value}.`;
      await interaction.editReply(recieptMessage + "\nI also DMed this message to you so you don't lose the code!");
      interaction.user.send(recieptMessage)
      .catch(() => {
        interaction.followUp({ content: "I wasn't able to send you the code! Do you have DMs allowed for server members? Please copy down your code somewhere safe ASAP. Please check with a member of Management if you lose your discount code.", flags: ["Ephemeral"] });
      });
      const embed = u.embed({ author: interaction.member })
        .addFields(
          { name: "Amount", value: `${gb}${-withdraw.value} ($${-withdraw.value / 100})` },
          { name: "Balance", value: `${gb}${balance.gb + withdraw.value}` }
        )
        .setDescription(`**${u.escapeText(interaction.member.displayName)}** just redeemed ${gb} for a store coupon code.`);
      interaction.client.getTextChannel(u.sf.channels.team.logistics)?.send({ embeds: [embed] });
    } else {
      interaction.editReply("Sorry, something went wrong. Please try again.");
    }
  } catch (e) { u.errorHandler(e, interaction); }
}


Module.addInteraction({
  name: "bank",
  guildId: u.sf.ldsg,
  onlyGuild: true,
  id: u.sf.commands.slashBank,
  options: { registry: "slashBank" },
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
.setShared({ buyGame, limit, gb, ember });

/**
 * @typedef {{ buyGame: buyGame, limit: limit, gb: gb, ember: ember }} BankShared
 */

module.exports = Module;
