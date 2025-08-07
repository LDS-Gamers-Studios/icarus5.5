// @ts-check

const Augur = require("augurbot-ts"),
  u = require("../utils/utils"),
  config = require("../config/config.json"),
  { customAlphabet } = require("nanoid");

const snipcart = require("../utils/snipcart");
const Discord = require("discord.js");

const Module = new Augur.Module(),
  gb = `<:gb:${u.sf.emoji.gb}>`,
  ember = `<:ember:${u.sf.emoji.ember}>`,
  limit = { gb: 1000, ember: 10000 };

const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoid = customAlphabet(chars, 8);

/**
 * @param {Omit<import("../database/controllers/bank").CurrencyRecord, "timestamp" | "discordId" | "otherUser">} withdrawalTransaciton
 * @param {Discord.GuildMember} giver
 * @param {Discord.GuildMember | null} [recipient]
 * @param {Discord.EmbedBuilder} [giverEmbed]
 */
async function transferCurrency(withdrawalTransaciton, giver, recipient, giverEmbed) {

  giverEmbed ??= u.embed({ author: giver.client.user });

  const withdrawal = await u.db.bank.addCurrency({ ...withdrawalTransaciton, discordId: giver.id, otherUser: recipient?.id ?? giver.client.user.id });
  const postWithdrawalBalance = await u.db.bank.getBalance(giver.id);

  giverEmbed.addFields([
    { name: "Transaction Note", value: withdrawalTransaciton.description },
    { name: "Your New Balance", value: `${gb}${postWithdrawalBalance.gb}\n${ember}${postWithdrawalBalance.em}` },
  ]);
  giver.send({ embeds: [giverEmbed] }).catch(u.noop);

  if (recipient && recipient.id !== recipient.client.user.id) {
    const depositTransaction = {
      ...withdrawalTransaciton,
      discordId: recipient.id,
      otherUser: giver.id,
      value: -withdrawalTransaciton.value
    };

    const deposit = await u.db.bank.addCurrency(depositTransaction);
    const postDepositBalance = await u.db.bank.getBalance(deposit.discordId);

    const recipientEmbed = u.embed({ author: giver.client.user })
        .addFields([
          { name: "Reason", value: deposit.description },
          { name: "Your New Balance", value: `${gb}${postDepositBalance.gb}\n${ember}${postDepositBalance.em}` }
        ])
        .setDescription(`${u.escapeText(giver.toString())} just gave you ${withdrawal.currency === "gb" ? gb : ember}${withdrawal.value}.`);
    recipient.send({ embeds: [recipientEmbed] }).catch(u.noop);
  }
}

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
  const embed1 = u.embed()
    .setTitle("Game Code Redemption")
    .setDescription(`You just redeemed a key for:\n${game.title} (${game.system})`)
    .addFields(
      { name: "Cost", value: gb + game.cost, inline: true },
      { name: "Game Key", value: game.key ?? "Unknown" }
    );

  await transferCurrency({
    currency: "gb",
    description: `${game.title} (${game.system}) Game Key`,
    hp: false,
    value: -1 * game.cost
  }, user, null, embed1);


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

    let reply = "";

    if (!recipient) {
      return interaction.reply({ content: "You can't give to ***nobody***, silly.", flags: ["Ephemeral"] });
    } else if (recipient?.id === giver.id) {
      reply = "You can't give to ***yourself***, silly.";
    } else if (recipient?.user.bot) {
      reply = `Bots don't really have a use for ${coin}.`;
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

    await transferCurrency({
      currency,
      description: reason,
      hp: false,
      value
    }, giver, recipient);

    await interaction.reply(`${coin}${value} sent to ${u.escapeText(recipient.displayName)} for: ${reason}`);
    u.clean(interaction);

  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction*/
async function slashBankBalance(interaction) {
  try {
    await interaction.deferReply();
    const balance = await u.db.bank.getBalance(interaction.member.id);

    const embed = u.embed({
      author: interaction.member,
      description: `${gb}${balance.gb}\n${ember}${balance.em}`
    });

    interaction.editReply({ embeds: [embed] });
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

      const embed = u.embed({ author: interaction.member })
        .setDescription(
          `You have redeemed ${gb}${amount} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\n` +
          `Use code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\n`
        )
        .addFields([
          { name: "Discount Code", value: discount.code },
          { name: "Uses", value: discount.maxNumberOfUsages.toString() }
        ]);

      await transferCurrency({
        currency: "gb",
        description: "LDSG Store Discount Code",
        value: -amount,
        hp: false
      }, interaction.member, null, embed);

      await interaction.editReply({ content: "I also DMed this message to you so you don't lose the code!", embeds: [embed] });

      const alertEmbed = u.embed({ author: interaction.member })
        .setDescription(`**${u.escapeText(interaction.member.displayName)}** just redeemed ${gb} for a store coupon code.`)
        .addFields(
          { name: "Amount", value: `${gb}${amount} ($${amount / 100})` },
          { name: "New Balance", value: `${gb}${balance.gb - amount}` }
        );

      interaction.client.getTextChannel(u.sf.channels.team.logistics)?.send({ embeds: [alertEmbed] });
    } else {
      interaction.editReply("Sorry, something went wrong. Please try again.");
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashBankRedeemRac(interaction) {
  const balance = await u.db.bank.getBalance(interaction.user.id);
  if (balance.em < 700) return interaction.reply({ content: `Sorry, that costs ${ember}700. You only have ${balance.em}.`, flags: ["Ephemeral"] });

  const nameModal = new u.Modal()
    .setTitle("Rent A Channel")
    .setCustomId(u.customId())
    .addComponents(
      u.ModalActionRow().addComponents(
        new u.TextInput()
          .setCustomId("channelName")
          .setLabel("Channel Name")
          .setRequired(true)
          .setStyle(Discord.TextInputStyle.Short)
      ),
      u.ModalActionRow().addComponents(
        new u.TextInput()
          .setCustomId("description")
          .setLabel("Description/Context")
          .setRequired(false)
          .setStyle(Discord.TextInputStyle.Paragraph)
      )
    );

  await interaction.showModal(nameModal);

  const response = await interaction.awaitModalSubmit({ time: 5 * 60_000 }).catch(() => null);
  if (!response) return interaction.editReply("I fell asleep waiting for your input...");

  await response.deferReply({ flags: ["Ephemeral"] });

  const channelName = response.fields.getTextInputValue("channelName");
  const embed = u.embed({ author: interaction.member })
    .setTitle("RAC Thread Request")
    .setDescription(`${interaction.member} has requested a RAC thread.`)
    .addFields([
      { name: "Channel Name", value: channelName },
      { name: "Description/Context", value: response.fields.getTextInputValue("description") || "None Provided" }
    ])
    .setFooter({ text: interaction.member.id });

  const buttons = u.MessageActionRow().addComponents(
    new u.Button().setCustomId("racApprove").setLabel("Approve").setStyle(Discord.ButtonStyle.Success),
    new u.Button().setCustomId("racApproveRateM").setLabel("Approve (Rated M RAC)").setStyle(Discord.ButtonStyle.Secondary),
    new u.Button().setCustomId("racReject").setLabel("Reject").setStyle(Discord.ButtonStyle.Danger),
  );

  const alertChannel = interaction.client.getTextChannel(u.sf.channels.team.logistics);
  if (!alertChannel) throw new Error("Couldn't find logistics channel");

  await alertChannel.send({ content: `<@&${u.sf.roles.team.manager}>`, embeds: [embed], components: [buttons], allowedMentions: { parse: ["roles"] } });

  await transferCurrency({
    currency: "em",
    description: `RAC Thread - ${channelName.slice(0, 20)}`,
    hp: false,
    value: -700
  }, interaction.member, null, embed);

  embed.addFields({ name: "Your New Balance", value: `${gb}${balance.gb}\n${ember}${balance.em - 700}` });
  return response.editReply({ content: "Your RAC Thread request was successful!", embeds: [embed] });
}

/** @param {Augur.GuildInteraction<"Button">} int */
async function buttonRacApprove(int, ratedM = false) {
  const channelId = ratedM ? u.sf.channels.racHub2 : u.sf.channels.racHub;
  const channel = int.client.getTextChannel(channelId);
  if (!channel) throw new Error(`Couldn't find the RAC ${ratedM ? "2" : ""} channel.`);

  const embed = int.message.embeds[0]?.data;
  if (!embed?.fields || !embed?.footer?.text) throw new Error("Couldn't parse RAC request embed");

  await int.deferUpdate();

  const thread = await channel.threads.create({
    name: embed.fields[0].value,
    autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek,
    reason: "New RAC"
  });

  const user = int.guild.members.cache.get(embed.footer.text);
  if (user) {
    await thread.send({ content: `${user}, your requested Rent-A-Channel Thread has been approved.`, allowedMentions: { parse: ["users"] } });
    if (ratedM && !user.roles.cache.has(u.sf.roles.rated_m)) await user.send({ content: "Your requested Rent-A-Channel Thread has been approved. You'll need the Rated M role to access it." }).catch(u.noop);
  } else {
    await thread.send({ content: `Description/Context: ${embed.fields[1]?.value}` });
  }

  const updatedEmbed = u.embed(embed).setColor("Green");
  return int.editReply({ components: [], content: "RAC Channel Approved", embeds: [updatedEmbed] });
}

/** @param {Augur.GuildInteraction<"Button">} int */
async function buttonRacReject(int) {
  const embed = int.message.embeds[0]?.data;
  if (!embed?.fields || !embed?.footer?.text) throw new Error("Couldn't parse RAC request embed");

  await int.deferUpdate();

  const user = int.guild.members.cache.get(embed.footer.text);

  await u.db.bank.addCurrency({
    discordId: embed.footer.text,
    currency: "em",
    description: `RAC Thread Refund`,
    hp: false,
    otherUser: int.client.user.id,
    value: 700
  });

  const updatedEmbed = u.embed(embed).setColor("Red");

  const response = await user?.send({
    content: `Unfortunately your RAC Thread request for ${embed.fields[0].value} was rejected. It might already exist, violate our code of conduct, or not be a good fit for the server, among other reasons.\n` +
      `If you have any questions, feel free to contact a Discord Manager.\nYour ${ember}700 has been refunded.`,
    embeds: [updatedEmbed]
  }).catch(u.noop);

  await int.editReply({ content: `RAC Thread Rejected. ${response ? "" : "I wasn't able to notify the user."}`, components: [], embeds: [updatedEmbed] });
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
      case "redeem-ember": {
        switch (interaction.options.getString("item")) {
          case "rac": return slashBankRedeemRac(interaction);
          default: return u.errorHandler(new Error("Unhandled Bank Purchase"), interaction);
        }
      }
      // case "award": located in team.js
      default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
    }
  }
})
.setShared({ buyGame, limit, gb, ember, transferCurrency })
.addEvent("interactionCreate", (int) => {
  if (!int.isButton() || !int.inCachedGuild() || !int.customId.startsWith("rac")) return;
  if (!u.perms.calc(int.member, ["mgr"])) return int.reply({ content: "This button is for MGR+", flags: ["Ephemeral"] });

  switch (int.customId) {
    case "racApprove": buttonRacApprove(int); break;
    case "racApproveRateM": buttonRacApprove(int, true); break;
    case "racReject": buttonRacReject(int); break;
    default: return;
  }

  return true;
});

/**
 * @typedef {{ buyGame: buyGame, limit: limit, gb: gb, ember: ember, transferCurrency: transferCurrency }} BankShared
 */

module.exports = Module;
