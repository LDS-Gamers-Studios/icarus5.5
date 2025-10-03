const axios = require("axios");
const config = require("../config/config.json");

/**
 * @typedef DiscountCreateProps
 * @prop {string} name
 * @prop {string} trigger
 * @prop {string} code
 * @prop {string} type
 * @prop {number | null} [amount]
 * @prop {number | null} [rate]
 * @prop {boolean} [combinable]
 * @prop {number} [maxNumberOfUsages]
 *
 * @typedef DiscountProps
 * @prop {boolean} archived
 * @prop {string} id
 *
 * @typedef {DiscountCreateProps & DiscountProps} Discount
 */

const noApiKeyRegex = new RegExp(config.api.snipcart);

/**
 * @template T
 * @param {string} endpoint
 * @param {Record<any, any> | any[]} data
 * @param {string} method
 * @returns {Promise<T>}
 */
async function call(endpoint, data = {}, method = "get") {
  // @ts-ignore
  return axios({
    url: `https://app.snipcart.com/api/${endpoint}`,
    method,
    data,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${config.api.snipcart}`
    },
  })
  .catch(/** @param {axios.AxiosError} e */(e) => {
    const error = [
      `AxiosError: Code ${e.code} (${e.name})`,
      e.message
    ].join("\n")
      .replace(noApiKeyRegex, "<TOKEN>");

    throw new Error(error);
  })
  .then(/** @param {{ data: T }} res */ res => res.data);
}

/** @returns {Promise<Discount[]>} */
function getAllDiscounts() {
  return call("/discounts");
}

/**
 * @param {string} code
 * @returns {Promise<Discount | undefined>}
 */
function getDiscountByCode(code) {
  return getAllDiscounts().then(discounts => discounts.find(d => d.code === code));
}

/**
 * @param {DiscountCreateProps} discount
 * @returns {Promise<Discount>}
 */
function newDiscount(discount) {
  return call("/discounts", discount, "POST");
}

/**
 * @param {string} discountId
 * @param {DiscountCreateProps & Partial<DiscountProps>} discount
 * @returns {Promise<Discount | undefined>}
 */
function editDiscount(discountId, discount) {
  return call(`/discounts/${discountId}`, discount, "PUT");
}

/**
 * @param {string} discountId
 * @returns {Promise<{}>}
*/
function deleteDiscount(discountId) {
  return call(`/discounts/${discountId}`, undefined, "DELETE");
}

module.exports = {
  getDiscountByCode,
  getAllDiscounts,
  newDiscount,
  editDiscount,
  deleteDiscount
};
