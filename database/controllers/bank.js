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
 * @prop {String} otherUser  The user who gave the currency.
 * @prop {String} giver  The user who gave the currency. (old)
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
    return Bank.insertMany(data, { lean: true });
  },
  fixUp: async function() {
    /**
     * Record A: {
     *  discordId: 1
     *  giver: 1
     *  value: -5
     *  description: "To ...: message"
     *  time: 5ms
     * }
     *
     * Record B: {
     *  discordId: 2
     *  giver: 1
     *  value: 5
     *  description: "From ...: message"
     *  time: 7ms
     * }
     */
    const icarus = "1067667220571901982";
    // problem names
    // Kitten Atomic: I will monch you
    // LDSG Penguin: .* Edition
    // LDSG Benguin: .* Edition
    // ♛ LDSG Benguin: A mood ♛
    // LDSG Benguwuin: #TeamSeas Ed.
    // Amethyst Penguin: Dendro Villain
    // Spicy McPie: .* Trash
    // Spicy McPie: verified homie
    // Spicy McPie: Trash Gift Giver
    // Spicy McPie: Single compost
    // Spicy McPie: Goody two shoes
    // Ally ?: Vibing with Fam

    const all = await Bank.find({}, undefined, { lean: false }).exec();
    const allCol = new Discord.Collection(all.filter(a => !(a.hp && a.currency === "em")).map(a => {
      /** @type {CurrencyRecord & { _id: string, reason: string }} */
      const obj = a.toObject();
      return [a._id.toString(), obj];
    }));
    allCol.forEach(a => {
      if (!a.description.startsWith("To ") && !a.description.startsWith("From ")) {
        a.reason = a.description;
        return;
      }
      const split = a.description.split(": ");
      /** @type {string} */
      let reason;
      if (split[0].endsWith("Spicy McPie") || split[0].endsWith("Spicy McArchives") && (split[1].toLowerCase().endsWith("trash") || ["verified homie", "Trash Gift Giver", "Single compost", "Goody two shoes"].includes(split[1]))) {
        reason = split.slice(2).join(": ");
      } else if (split[0].match(/(LDSG)|(Amethyst) (P|B)enguin/) && (split[1].endsWith("Edition") || ["A mood ♛", "#TeamSeas Ed.", "Dendro Villain"].includes(split[1]))) {
        reason = split.slice(2).join(": ");
      } else if (a.description.match(/Ally ?: Vibing with fam/i)) {
        reason = split.slice(2).join(": ");
      } else if (a.description.match(/Kitten Atomic: I will monch you/)) {
        reason = split.slice(2).join(": ");
      } else {
        reason = split.slice(1).join(": ");
        if (reason === "") reason = "No particular reason";
      }
      if (reason === "No particular reason.") reason = "No particular reason";
      a.reason = reason;
    });
    /** @type {CurrencyRecord[][]} */
    const pairs = [];
    const negs = new Discord.Collection(all.filter(r => r.value < 1 && !(r.hp && r.currency === "em")).map(a => [a._id.toString(), a]));
    const pos = all.filter(r => r.value > 0 && !["209007104852230145", "1067667220571901982"].includes(r.giver) && !r.description.startsWith("LDSG Twitch")
      && !(r.hp && r.currency === "em")
    );

    for (const neg of Array.from(negs.values())) {
      if (neg.description.startsWith("LDSG Store") ||
        (!neg.description.startsWith("From") && neg.description.endsWith(" Game Key")) ||
        neg.description.endsWith(" SHIELD BREAK") ||
        neg.description.endsWith(" SHIELD BREAK!") ||
        neg.description.endsWith(" shield!") ||
        neg.description.startsWith("To Icarus: ") ||
        neg.description.startsWith("To Icarus - Bot Bird of Legend: ")
      ) {
        if (!neg.otherUser) {
          neg.otherUser = icarus;
          neg.save();
        }
        allCol.delete(neg._id.toString());
        negs.delete(neg._id.toString());
      }
      // staff overwrite
      if (["96354827579174912", "117454089385803780"].includes(neg.giver)) {
        negs.delete(neg._id.toString());
      }
    }
    const posCol = new Discord.Collection(pos.map(p => [p._id.toString(), p]));

    for (const p of pos) {
      const t = [p.timestamp.valueOf() + 1000, p.timestamp.valueOf() - 1000];
      const pReason = allCol.get(p._id.toString())?.reason;
      const a = negs.find(n => {
        const nReason = allCol.get(n._id.toString())?.reason;
        return n.discordId === p.giver && n.value === (0 - p.value) && p.currency === n.currency && nReason === pReason && n.timestamp.valueOf() < t[0] && n.timestamp.valueOf() > t[1];
      });
      if (!a) {
        if (["96354827579174912", "117454089385803780"].includes(p.giver)) {
          if (!p.otherUser) {
            p.otherUser = p.giver;
            p.save();
          }
          posCol.delete(p._id.toString());
          allCol.delete(p._id.toString());
        }
        continue;
      } else {
        if (!a.otherUser) {
          a.otherUser = p.discordId;
          a.save();
        }
        if (!p.otherUser) {
          p.otherUser = a.discordId;
          p.save();
        }
        pairs.push([p, a]);
        negs.delete(a._id.toString());
        allCol.delete(a._id.toString());
      }
      posCol.delete(p._id.toString());
      allCol.delete(p._id.toString());
    }
    /** @type {string[]} */
    const failed = [];
    allCol.forEach((a, id) => {
      const rec = all.find(al => al._id.toString() === id);
      if (!rec) return failed.push(id);
      if (!rec.otherUser) {
        rec.otherUser = rec.giver;
        rec.save();
      }
    });
    all.filter(a => (a.hp && a.currency === "em")).forEach(a => {
      if (!a.otherUser) {
        a.otherUser = a.giver;
        a.save();
      }
    });
    return failed;
  }
};
