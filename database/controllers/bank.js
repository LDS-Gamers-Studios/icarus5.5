// @ts-check
const moment = require("moment-timezone");
const Bank = require("../models/Bank.model");
const Discord = require("discord.js");
/**
 * @typedef CurrencyRecord
 * @prop {String} discordId  The user who recieved the currency.
 * @prop {Date} timestamp When the transaction occured
 * @prop {String} description Description about the transaction
 * @prop {Number} value  The amount given.
 * @prop {String} currency The type of currency to give. (em or gb) Defaults to em
 * @prop {String} [otherUser]  The user who gave the currency.
 * @prop {String} [giver]  The user who gave the currency. (old)
 * @prop {Boolean} hp Whether the addition counts for house points.
 */

const outdated = "Expected a Discord ID but likely recieved an object instead. That's deprecated now!";

module.exports = {
  /**
   * Get all user records
   * @param {string} discordId
   * @return {Promise<CurrencyRecord[]>}
   */
  getAll: async function(discordId) {
    if (typeof discordId !== "string") throw new TypeError(outdated);
    return Bank.find({ discordId }, undefined, { lean: true }).exec();
  },
  /**
   * @param {string[]} discordIds
   * @param {moment.Moment} [startDate]
   * @return {Promise<CurrencyRecord[]>}
   */
  getReport: async function(discordIds, startDate) {
    if (!startDate) {
      const seasonStart = moment.tz("America/Denver").startOf("month").hour(19);
      const monthsAgo = seasonStart.month() % 4;
      seasonStart.subtract(monthsAgo, "months");
      startDate ??= seasonStart;
    }

    return Bank.find({
      discordId: { $in: discordIds },
      currency: "em",
      hp: true,
      timestamp: { $gte: startDate.toDate() }
    }, undefined, { lean: true }).exec();
  },
  /**
   * Gets a user's current balance for a given currency.
   * @param {String} discordId The user whose balance you want to view.
   * @return {Promise<{discordId: string, gb: number, em: number}>} Object with `discordId` and `balance` properties.
   */
  getBalance: async function(discordId) {
    if (typeof discordId !== "string") throw new TypeError(outdated);
    const record = await Bank.aggregate([
      { $match: { discordId } },
      { $group: {
        _id: null,
        em: { $sum: { $cond: { if: { $eq: ["$currency", "em"] }, then: "$value", else: 0 } } },
        gb: { $sum: { $cond: { if: { $eq: ["$currency", "gb"] }, then: "$value", else: 0 } } }
      } }
    ]).exec();
    return { discordId, gb: record[0]?.gb ?? 0, em: record[0]?.em ?? 0 };
  },
  /**
     * Adds currency to a user's account.
     * @param {Omit<CurrencyRecord, "timestamp">} data The data object.
     * @return {Promise<CurrencyRecord>} A record of the addition.
  */
  addCurrency: function(data) {
    if (typeof data.discordId !== 'string' || typeof data.giver !== 'string') throw new TypeError(outdated);
    return new Bank(data).save();
  },
  /**
   * Adds many currency records
   * @param {CurrencyRecord[]} data The data object.
   * @return {Promise<CurrencyRecord[]>} A record of the addition.
   */
  addManyTransactions: function(data) {
    return Bank.insertMany(data.map(d => new Bank(d)), { lean: true });
  },
  fixUp: async function() {

    const icarus = ["1067667220571901982", "209007104852230145"];

    const namesIncluded = 1520312400000;
    const mgmtDeducted = 1622776344000;

    const updated = [];

    await Bank.deleteMany({ value: 0 }).exec();

    const awards = await Bank.find({ otherUser: null, hp: true, currency: "em" }).exec();
    for (const award of awards) {
      award.set("otherUser", award.giver);
      updated.push(award);
    }
    await Bank.bulkSave(awards);

    const problems = [
      "Kitten Atomic: I will monch you: ",
      "LDSG Penguin: GG Fluffy Edition: ",
      "LDSG Penguin: 2021 Edition: ",
      "LDSG Penguin: Spoopy Edition: ",
      "LDSG Benguin: NaNoWriMo Edition: ",
      "♛ LDSG Benguin: A mood ♛: ",
      "LDSG Benguwuin: #TeamSeas Ed.: ",
      "Amethyst Penguin: Dendro Villain: ",
      "Ally : Vibing with Fam: ",
      "Ally: Vibing with Fam: ",
      "Spicy McPie: Wise Trash: ",
      "Spicy McPie: Christmas Trash: ",
      "Spicy McPie: Cuwute Trash: ",
      "Spicy McPie: Spooky Trash: ",
      "Spicy McPie: Valentines Trash: ",
      "Spicy McPie: Cozy Trash: ",
      "Spicy McPie: Bouncy Trash: ",
      "Spicy McPie: Bouncy trash: ",
      "Spicy McPie: Stabby Trash: ",
      "Spicy McPie: verified homie: ",
      "Spicy McPie: Trash Gift Giver: ",
      "Spicy McPie: Single compost: ",
      "Spicy McPie: Garnelen's Trash: ",
      "Spicy McPie: Amazed Trash: ",
      "Spicy McPie: Thankful Trash: ",
      "Spicy McPie: Goody two shoes: ",
      "Spicy McArchives: Bouncy trash: ",
    ];

    const all = await Bank.find({});
    // eslint-disable-next-line no-unused-vars
    for (const record of all) {
      if (record.timestamp.valueOf() < namesIncluded) continue;

      if (!record.description.includes(":")) continue;

      if (record.description.startsWith("To Icarus: ") || record.description.startsWith("To Icarus - Bot Bird of Legend: ")) record.set("otherUser", icarus[0]);

      let split = record.description.split(": ");

      // either an emoji or a colon in the username
      if (split[2]) {
        const problem = problems.find(p => record.description.includes(p));
        if (problem) {
          split = record.description.split(problem);
        }
      }
      record.set("description", (split.slice(1).join(": ") || record.description).trim());
    }

    await Bank.bulkSave(all);

    const nA = await Bank.find({ otherUser: null, $or: [{ currency: "gb" }, { hp: false, currency: "em" } ] }).exec();
    const nonAwards = new Discord.Collection(nA.map(a => [a._id.toString(), a]));

    const positiveOG = new Discord.Collection(nonAwards.filter(a => a.value > 0).map(a => [a._id.toString(), a]));
    const positive = positiveOG.clone();
    const negativeOG = new Discord.Collection(nonAwards.filter(a => a.value < 0).map(a => [a._id.toString(), a]));
    const negative = negativeOG.clone();

    const admins = ["96335658997526528", "96354827579174912", "117454089385803780", "96356134809526272", "111232201848295424"];

    for (const [id, neg] of negativeOG) {
      // giving to icarus
      if (icarus.includes(neg.giver) ||
        neg.description.startsWith("LDSG Store") ||
        neg.description.endsWith(" Game Key") ||
        neg.description.endsWith(" SHIELD BREAK") ||
        neg.description.endsWith(" SHIELD BREAK!") ||
        neg.description.endsWith(" shield!")
      ) {
        neg.set("otherUser", icarus[0]);
        updated.push(neg);
        negative.delete(id);
      } else if (admins.includes(neg.giver) && neg.timestamp.valueOf() < mgmtDeducted) {
        neg.set("otherUser", neg.giver);
        updated.push(neg);
        negative.delete(id);
      }
    }

    for (const [id, pos] of positiveOG) {
      if (icarus.includes(pos.giver) || pos.description.startsWith("Chat Rank Reset") ||
      pos.description.startsWith("Feather drop in") ||
      pos.description.startsWith("LDSG Twitch")
      ) {
        pos.set("otherUser", icarus[0]);
        updated.push(pos);
        positive.delete(id);
        continue;
      }

      const timeRange = [pos.timestamp.valueOf() + 1000, pos.timestamp.valueOf() - 1000];
      const withdrawl = negative.find(neg =>
        neg.discordId === pos.giver &&
        neg.value === (0 - pos.value) &&
        pos.currency === neg.currency &&
        neg.description === pos.description &&
        neg.timestamp.valueOf() < timeRange[0] && neg.timestamp.valueOf() > timeRange[1]
      );

      if (!withdrawl) {
        if (admins.includes(pos.giver) && pos.timestamp.valueOf() < mgmtDeducted) {
          pos.set("otherUser", pos.giver);
          updated.push(pos);
          positive.delete(id);
          continue;
        }
      } else {
        pos.set("otherUser", withdrawl.discordId);
        negativeOG.get(withdrawl._id.toString())?.set("otherUser", pos.discordId);
        updated.push(pos, withdrawl);

        positive.delete(id);
        negative.delete(withdrawl._id.toString());
      }
    }
    console.log(positive.size, negative.size);

    /**
     * Final few queries
     * { description: { $regex: RegExp("To ") } }
     * Update description to "No particular reason.", then do a manual lookup with the csv
     * 
      * {
          otherUser: { $exists: false },
          giver: { $ne: "418541234387288064" },
          value: { $gt: 0 }
        }

        Update otherUser to giver

        {
          otherUser: { $exists: false },
          giver: { $ne: "418541234387288064" }
        }
        Do a manual lookup with the csv
     */
    return Bank.bulkSave(updated);
  }
};
