// @ts-check
const moment = require('moment-timezone');

const Infraction = require("../models/Infraction.model");

/**
 * @typedef Infraction
 * @prop {String} discordId User's Discord Id
 * @prop {String} [channel] The channel Id where the infraction took place
 * @prop {String} [message] The message Id where the infraction took place
 * @prop {String} [flag] The mod flag created for the infraction
 * @prop {String} [description] The description of the infraction
 * @prop {Number} value The point value of the infraction
 * @prop {String} mod The mod's Discord Id
 * @prop {String} [handler] Who handled the flag
 * @prop {Date} timestamp The time the flag was created
 */

const outdated = "Expected a Discord ID but likely recieved an object instead. That's deprecated now!";

module.exports = {

  /**
   * Get an infraction by its associated mod flag.
   * @param {String} flagId The mod flag ID for the infraction
   * @returns {Promise<Infraction | null>}
   */
  getByFlag: function(flagId) {
    if (typeof flagId != "string") throw new TypeError(outdated);
    return Infraction.findOne({ flag: flagId }, undefined, { lean: true }).exec();
  },
  /**
   * Get an infraction by its associated mod flag.
   * @param {String} message The flagged message ID
   * @returns {Promise<Infraction | null>}
   */
  getByMsg: function(message) {
    if (typeof message != "string") throw new TypeError(outdated);
    return Infraction.findOne({ message }, undefined, { lean: true }).exec();
  },
  /**
   * Get a summary of a user's infractions.
   * @param {String} discordId The user whose summary you want to view.
   * @param {Number} [time] The time in days to review.
   */
  getSummary: async function(discordId, time = 28) {
    if (typeof discordId != "string") throw new TypeError(outdated);
    const since = moment().tz("America/Denver").subtract(time, "days");
    /** @type {Infraction[]} */
    const records = (await Infraction.find({ discordId, timestamp: { $gte: since } }, undefined, { lean: true })
      .exec())
      // -1 is cleared
      .filter(r => r.value > -1);
    return {
      discordId,
      count: records.length,
      points: records.reduce((c, r) => c + r.value, 0),
      time,
      detail: records
    };
  },
  /**
     * Remove/delete an infraction
     * @param {String} flag The infraction flag
     * @return {Promise<Infraction | null>}
     */
  remove: function(flag) {
    if (typeof flag != "string") throw new TypeError(outdated);
    return Infraction.findOneAndDelete({ flag }, { new: false, lean: true }).exec();
  },
  /**
     * Save an infraction
     * @param {Omit<Infraction, "timestamp">} data Data to save
     * @return {Promise<Infraction>}
     */
  save: function(data) {
    if (data.message && typeof data.message != "string") throw new TypeError(outdated);
    if (data.channel && typeof data.channel != "string") throw new TypeError(outdated);
    if (data.flag && typeof data.flag != "string") throw new TypeError(outdated);
    if (data.mod && typeof data.mod != "string") throw new TypeError(outdated);
    if (data.handler && typeof data.handler != "string") throw new TypeError(outdated);

    return new Infraction(data).save().then(i => i.toObject());
  },
  /**
   * Update an infraction
   * @param {Infraction} infraction The edited infraction
   * @return {Promise<Infraction | null>}
   */
  update: function(infraction) {
    return Infraction.findOneAndUpdate({ flag: infraction.flag }, { handler: infraction.handler, value: infraction.value }, { new: true, lean: true }).exec();
  }
};