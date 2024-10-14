// @ts-check
const Bank = require("../models/Bank.model");

/**
 * @typedef CurrencyRecord
 * @prop {String} discordId  The user who recieved the currency.
 * @prop {Date} timestamp When the transaction occured
 * @prop {String} description Description about the transaction
 * @prop {Number} value  The amount given.
 * @prop {String} currency The type of currency to give. (em or gb) Defaults to em
 * @prop {String} giver  The user who gave the currency.
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
    return Bank.find({ discordId }, undefined, { lean: true });
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
  }
};
