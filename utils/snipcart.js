const axios = require("axios");
const config = require("../config/config.json");

const noApiKeyRegex = new RegExp(config.api.snipcart, "gi");

/**
 * @param {string} endpoint
 */
async function callApi(endpoint, data = {}, method = "get") {
  if (!config.api.snipcart) return null;

  // @ts-ignore
  return axios({
    baseURL: "https://app.snipcart.com/api",
    url: endpoint,
    data,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    auth: { username: config.api.snipcart, password: "" },
    method
  }).catch(/** @param {axios.AxiosError} e */(e) => {
    const error = [
      `AxiosError: Code ${e.code} (${e.name})`,
      e.message
    ].join("\n")
      .replace(noApiKeyRegex, "<TOKEN>");

    throw new Error(error);
  }).then(/** @param {any} res */ (res) => res.data);
}

/**
 * @typedef Discount
 * @prop {string} name
 * @prop {boolean} combinable
 * @prop {number} maxNumberOfUsages
 * @prop {string} trigger
 * @prop {string} code
 * @prop {string} type
 * @prop {number} amount
 */

/**
 * @param {Discount} discountInfo
 * @returns {Promise<Discount>}
 */

function newDiscount(discountInfo) {
  return callApi("/discounts", discountInfo, "POST");
}

module.exports = { newDiscount };
