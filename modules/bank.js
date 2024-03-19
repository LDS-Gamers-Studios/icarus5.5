// @ts-check

const Augur = require("augurbot-ts"),
  Discord = require('discord.js'),
  p = require("../utils/perms"),
  u = require("../utils/utils"),
  config = require("../config/config.json");

const Module = new Augur.Module(),
  gb = () => Module.client.emojis.cache.get(u.sf.emoji.gb),
  ember = () => Module.client.emojis.cache.get(u.sf.emoji.ember),
  limit = { gb: 1000, ember: 10000 };

const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(config.google.sheets.games);

const { customAlphabet } = require("nanoid"),
  chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  nanoid = customAlphabet(chars, 8);

let steamGameList;

/**
 * @typedef Game
 * @prop {string} Title
 * @prop {string} System
 * @prop {string} Rating
 * @prop {string} Cost
 * @prop {string | undefined} Recipient
 * @prop {string | undefined} Code
 * @prop {string | undefined} Key
 * @prop {string | undefined} Date
 * @prop {() => Promise<any>} save
 */

/** @return {Promise<Game[] | void>} */
async function getGameList() {
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    // @ts-ignore
    let games = await doc.sheetsByIndex.getRows();
    games = games.filter(g => !g.Recipient).filter(filterUnique);
    return games;
  } catch (e) { u.errorHandler(e, "Fetch Game List"); }
}

/**
 *
 * @param {Game} game
 * @param {number} i
 * @param {Game[]} games
 * @returns {boolean}
 */
function filterUnique(game, i, games) {
  const ga = games.find(g => g.Title == game.Title && g.System == game.System);
  if (ga) return games.indexOf(ga) == i;
  else return false;
}

/**

 * @param {Discord.GuildMember} member
 */
function getHouseInfo(member) {
  const houseInfo = new Map([
    [u.sf.roles.housebb, { name: "Brightbeam", color: "#00a1da" }],
    [u.sf.roles.housefb, { name: "Freshbeast", color: "#fdd023" }],
    [u.sf.roles.housesc, { name: "Starcamp", color: "#e32736" }]
  ]);

  for (const [k, v] of houseInfo) {
    if (member.roles.cache.has(k)) return v;
  }
  return { name: "Unsorted", color: config.color };
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankGive(interaction) {
  try {
    const giver = interaction.member;
    const recipient = interaction.options.getMember("recipient");
    const currency = interaction.options.getString("currency", true);
    let value = interaction.options.getInteger("amount", true);
    let reason = interaction.options.getString("reason");
    if (!recipient) return interaction.reply({ content: "You can't give to *nobody*, silly.", ephemeral: true });

    const toIcarus = recipient.id == interaction.client.user.id;
    const { coin, MAX } = (currency == "gb" ? { coin: gb(), MAX: limit.gb } : { coin: ember(), MAX: limit.ember });

    if (recipient.id == giver.id) {
      return interaction.reply({ content: "You can't give to *yourself*, silly.", ephemeral: true });
    } else if (toIcarus && currency == "gb") {
      return interaction.reply({ content: `I don't need any ${coin}! Keep em for yourself.`, ephemeral: true });
    } else if (toIcarus && (!reason || reason.length == 0)) {
      return interaction.reply({ content: `You need to have a reason to give ${coin} to me!`, ephemeral: true });
    } else if (value === 0) {
      return interaction.reply({ content: "You can't give *nothing*.", ephemeral: true });
    } else if (value < 0) {
      return interaction.reply({ content: `One does not simply *take* ${coin}, silly.`, ephemeral: true });
    }


    reason ??= "No particular reason";
    value = value > MAX ? MAX : (value < -MAX ? -MAX : value);

    const account = await u.db.bank.getBalance(giver.id, currency);
    if (value > account.balance) {
      return interaction.reply({ content: `You don't have enough ${coin} to give! You can give up to ${coin}${account.balance}`, ephemeral: true });
    }

    if (!toIcarus) {
      const deposit = {
        currency,
        discordId: recipient.id,
        description: `From ${giver.displayName}: ${reason}`,
        value,
        giver: giver.id
      };
      const receipt = await u.db.bank.addCurrency(deposit);
      const gbBalance = await u.db.bank.getBalance(recipient.id, "gb");
      const emBalance = await u.db.bank.getBalance(recipient.id, "em");
      const embed = u.embed({ author: interaction.client.user })
        .addFields(
          { name: "Reason", value: reason },
          { name: "Your New Balance", value: `${gb()}${gbBalance.balance}\n${ember()}${emBalance.balance}` }
        )
        .setDescription(`${u.escapeText(giver.toString())} just gave you ${coin}${receipt.value}.`);
      recipient.send({ embeds: [embed] }).catch(u.noop);
    }
    await interaction.reply(`${coin}${value} sent to ${u.escapeText(recipient.displayName)} for reason: ${reason}`);
    u.clean(interaction);

    const withdrawal = {
      currency,
      discordId: giver.id,
      description: `To ${recipient.displayName}: ${reason}`,
      value: -value,
      giver: giver.id
    };
    const receipt = await u.db.bank.addCurrency(withdrawal);
    const gbBalance = await u.db.bank.getBalance(giver.id, "gb");
    const emBalance = await u.db.bank.getBalance(giver.id, "em");
    const embed = u.embed({ author: interaction.client.user })
      .addFields(
        { name: "Reason", value: reason },
        { name: "Your New Balance", value: `${gb()}${gbBalance.balance}\n${ember()}${emBalance.balance}` }
      )
      .setDescription(`You just gave ${coin}${-receipt.value} to ${u.escapeText(recipient.displayName)}.`);
    giver.send({ embeds: [embed] }).catch(u.noop);

    if ((currency == "em") && toIcarus) {
      const hoh = interaction.client.getTextChannel(u.sf.channels.headsofhouse);
      const hohEmbed = u.embed({ author: interaction.client.user })
        .addFields({ name: "Reason", value: reason })
        .setDescription(`**${u.escapeText(giver.displayName)}** gave me ${coin}${value}.`);
      hoh?.send({ content: `<@&${u.sf.roles.manager}>`, embeds: [hohEmbed] });
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankBalance(interaction) {
  try {
    const member = interaction.member;
    const gbBalance = await u.db.bank.getBalance(member, "gb");
    const emBalance = await u.db.bank.getBalance(member, "em");
    const embed = u.embed({ author: member })
      .setDescription(`${gb()}${gbBalance.balance}\n${ember()}${emBalance.balance}`);
    interaction.reply({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankGameList(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    let games = await getGameList();
    if (!games) throw new Error("Games List Error");
    for (const game of games.filter(g => !g.Code)) {
      game.Code = nanoid();
      game.save();
    }

    games = games.sort((a, b) => a.Title.localeCompare(b.Title));
    // Filter Rated M, unless the member has the Rated M Role
    if (!interaction.member?.roles.cache.has(u.sf.roles.rated_m)) games = games.filter(g => g.Rating.toUpperCase() != "M");

    interaction.editReply(`Watch your DMs for a list of games that can be redeemed with ${gb()}!`);

    const embed = u.embed()
      .setTitle("Games Available to Redeem")
      .setDescription(`Redeem ${gb()} for game codes with the </bank game redeem:${u.sf.commands.slashBank}:> command.`);
    let e = embed;
    const embeds = [];
    for (const game of games) {
      let steamApp = null;
      if (game.System?.toLowerCase() == "steam") {
        steamApp = steamGameList.find(g => g.name.toLowerCase() == game.Title.toLowerCase());
      }
      const content = `\n**${game.Title}** (${game.System}) ${game.Rating ?? ""}`
        + `\n${steamApp ? `[Steam Store Page](https://store.steampowered.com/app/${steamApp.appid})` : ""}`
        + `</bank game redeem code:${game.Code}:${u.sf.commands.slashBank}:>\n`;
      if ((e.data.description?.length || 0) + content.length > 2000) {
        embeds.push(e);
        e = embed;
      }
      e.setDescription(e.data.description + content);
    }
    embeds.push(e);

    let embedsToSend = [];
    let totalLength = 0;
    while (embeds.length > 0) {
      const embed2 = embeds.shift();
      if (!embed2) break;
      if (totalLength + embed2.length > 6000) {
        try {
          await interaction.user.send({ embeds: embedsToSend }).catch(u.noop);
        } catch (err) {
          interaction.editReply(`There was an error while sending you the list of games that can be redeemed with ${gb()}. Do you have DMs blocked from members of this server? You can check this in your Privacy Settings for the server.`);
          embedsToSend = [];
          break;
        }
        embedsToSend = [];
        totalLength = 0;
      }
      embedsToSend.push(embed2);
      totalLength += embed2.length;
    }
    if (embedsToSend.length > 0) {
      interaction.user.send({ embeds: embedsToSend }).catch(u.noop);
    }

  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankGameRedeem(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const games = await getGameList();
    if (!games) throw new Error("Get Game List Error");
    const game = games.find(g => (g.Code == interaction.options.getString("code", true).toUpperCase()));
    if (!game) {
      interaction.editReply(`I couldn't find that game. Use </bank game list:${u.sf.commands.slashBank}:>to see available games.`);
      return;
    }

    const systems = {
      steam: {
        redeem: "https://store.steampowered.com/account/registerkey?key=",
        img: `https://cdn.discordapp.com/emojis/${u.sf.emoji.steam}.png`
      }
    };

    const balance = await u.db.bank.getBalance(interaction.user.id, "gb");
    if (balance.balance < game.Cost) {
      return interaction.editReply(`You don't currently have enough ${gb()}. Sorry!`);
    }

    interaction.editReply("Watch your DMs for the game you redeemed!");

    await u.db.bank.addCurrency({
      currency: "gb",
      discordId: interaction.user.id,
      description: `${game.Title} (${game.System}) Game Key`,
      value: -1 * parseInt(game.Cost),
      giver: interaction.user.id
    });

    let embed = u.embed()
    .setTitle("Game Code Redemption")
    .setDescription(`You just redeemed a key for:\n${game.Title} (${game.System})`)
    .addFields(
      { name: "Cost", value: gb + game.Cost, inline: true },
      { name: "Balance", value: `${gb()}${balance.balance - parseInt(game.Cost)}`, inline: true },
      { name: "Game Key", value: game.Key ?? "Uknown" }
    );

    if (systems[game.System?.toLowerCase()]) {
      const sys = systems[game.System.toLowerCase()];
      embed.setURL(sys.redeem + game.Key)
      .addFields({ name: "Key Redemption Link", value: `[Redeem key here](${sys.redeem + game.Key})` })
      .setThumbnail(sys.img);
    }

    game.Recipient = interaction.user.username;
    game.Date = new Date().toDateString();
    game.save();
    interaction.user.send({ embeds: [embed] }).catch(() => {
      interaction.followUp("I wasn't able to send you the game key! Do you have DMs allowed for server members? Please check with a member of Management to get your game key.");
    });

    embed = u.embed({ author: interaction.member })
    .setDescription(`${interaction.user.username} just redeemed a key for a ${game.Title} (${game.System}) key.`)
    .addFields(
      { name: "Cost", value: gb() + game.Cost, inline: true },
      { name: "Balance", value: `${gb()}${balance.balance - parseInt(game.Cost)}`, inline: true }
    );
    interaction.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankDiscount(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger("amount", true);
    const balance = await u.db.bank.getBalance(interaction.user.id, "gb");
    if ((amount > balance.balance) || (amount < 0) || (amount > limit.gb)) {
      return interaction.editReply(`That amount (${gb()}${amount}) is invalid. You can currently redeem up to ${gb()}${Math.max(balance.balance, limit.gb)}.`);
    }

    const snipcart = require("../utils/snipcart")(u.config.api.snipcart);
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
        giver: interaction.user.id
      };
      const withdraw = await u.db.bank.addCurrency(withdrawal);

      await interaction.editReply("Watch your DMs for the code you just redeemed!");
      interaction.user.send(`You have redeemed ${gb()}${withdraw.value} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\nUse code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\nYou now have ${gb()}${balance.balance + withdraw.value}.`)
      .catch(() => {
        interaction.followUp({ content: "I wasn't able to send you the code! Do you have DMs allowed for server members? Please check with a member of Management to get your discount code.", ephemeral: true });
      });
      const embed = u.embed({ author: interaction.member })
      .addFields(
        { name: "Amount", value:  `${gb()}${-withdraw.value}\n$${-withdraw.value / 100}` },
        { name: "Balance", value: `${gb()}${balance.balance + withdraw.value}` }
      )
      .setDescription(`**${u.escapeText(interaction.member.displayName)}** just redeemed ${gb()} for a store coupon code.`);
      interaction.client.getTextChannel(u.sf.channels.management)?.send({ embeds: [embed] });
    } else {
      interaction.editReply("Sorry, something went wrong. Please try again.");
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankAward(interaction) {
  try {
    const giver = interaction.member;
    const recipient = interaction.options.getMember("recipient");
    const reason = interaction.options.getString("reason") || "Astounding feats of courage, wisdom, and heart";
    let value = interaction.options.getInteger("amount", true);
    if (!recipient) return interaction.reply({ content: "You can't just award *nobody*!" });

    if (!p.calc(giver, { team: true, volunteer: true, house: true })) {
      return interaction.reply({ content: `*Nice try!* This command is for Volunteers and Team+ only!`, ephemeral: true });
    } else if (recipient.id == giver.id) {
      return interaction.reply({ content: `You can't award *yourself* ${ember()}, silly.`, ephemeral: true });
    } else if (recipient.id == interaction.client.user.id) {
      return interaction.reply({ content: `You can't award *me* ${ember()}, silly.`, ephemeral: true });
    } if (value === 0) {
      return interaction.reply({ content: "You can't award *nothing*.", ephemeral: true });
    }
    value = value < 0 ? Math.max(value, -1 * limit.ember) : Math.min(value, limit.ember);

    const award = {
      currency: "em",
      discordId: recipient.id,
      description: `From ${giver.displayName} (House Points): ${reason}`,
      value,
      giver: giver.id,
      hp: true
    };

    const receipt = await u.db.bank.addCurrency(award);
    const gbBalance = await u.db.bank.getBalance(recipient.id, "gb");
    const emBalance = await u.db.bank.getBalance(recipient.id, "em");
    const str = (m) => value > 0 ? `awarded ${m} ${ember()}${receipt.value}` : `docked ${ember()}${-receipt.value} from ${m}`;
    let embed = u.embed({ author: interaction.client.user })
      .addFields(
        { name:"Reason", value: reason },
        { name: "Your New Balance", value: `${gb()}${gbBalance.balance}\n${ember()}${emBalance.balance}` }
      )
      .setDescription(`${u.escapeText(giver.displayName)} just ${str("you")}! This counts toward your House's Points.`);
    recipient.send({ embeds: [embed] }).catch(u.noop);

    await interaction.reply(`Successfully ${str(recipient.displayName)} for ${reason}`);
    u.clean(interaction, 60000);

    embed = u.embed({ author: interaction.client.user })
      .addFields({ name: "Reason", value: reason })
      .setDescription(`You just ${str(recipient.displayName)}. This counts towards their House's Points.`);
    giver.send({ embeds: [embed] }).catch(u.noop);

    const house = getHouseInfo(recipient);

    const mopbucket = interaction.client.getTextChannel(u.sf.channels.mopbucketawards);
    embed = u.embed({ author: interaction.client.user })
      .setColor(house.color)
      .addFields(
        { name: "House", value: house.name },
        { name: "Reason", value: reason }
      )
      .setDescription(`**${giver}** ${str(recipient)}`);
    mopbucket?.send({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

Module.addInteraction({ name: "bank",
  // guild: u.sf.ldsg
  onlyGuild: true,
  id: u.sf.commands.slashBank,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
    case "give":
      await slashBankGive(interaction);
      break;
    case "balance":
      await slashBankBalance(interaction);
      break;
    case "list":
      await slashBankGameList(interaction);
      break;
    case "redeem":
      await slashBankGameRedeem(interaction);
      break;
    case "discount":
      await slashBankDiscount(interaction);
      break;
    case "award":
      await slashBankAward(interaction);
      break;
    }
  }
})
.setInit(async function(gl) {
  try {
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
