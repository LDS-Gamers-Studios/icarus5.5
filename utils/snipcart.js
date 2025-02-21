const axios = require("axios");

/** @param {any} auth */
const SnipCart = function(auth) {
  this.key = auth;

  /**
   * @param {string} call
   * @param {Record<any, any>} [data]
   * @param {string} method
   * @returns {Promise<any>}
   */
  this.callApi = async function(call, data = {}, method = "get") {
    method = method.toUpperCase();

    call = encodeURI(call);

    if (method === "GET") {
      const urlParams = Object.keys(data).map((key) =>
        encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
      ).join("&");
      call += (urlParams ? "?" + urlParams : "");
    }

    // @ts-ignore
    const response = await axios({
      baseURL: "https://app.snipcart.com/api",
      url: call,
      data,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      auth: {
        username: this.key, password: ""
      },
      method
    });

    return response.data;
  };

  // DISCOUNTS

  /** @param {string | { id: string }} discount */
  this.deleteDiscount = function(discount) {
    const id = ((typeof discount === "string") ? discount : discount.id);
    return this.callApi(`/discounts/${id}`, undefined, "DELETE");
  };

  /** @param {{ id: string }} discount */
  this.editDiscount = function(discount) {
    return this.callApi(`/discounts/${discount.id}`, discount, "PUT");
  };

  /** @param {string | { id: string }} code */
  this.getDiscountCode = function(code) {
    return new Promise((fulfill, reject) => {
      this.callApi("/discounts").then(discounts =>
        fulfill(discounts.find(/** @param {any} d */ d => d.code === code))
      ).catch(reject);
    });
  };

  this.getDiscounts = function() {
    return this.callApi("/discounts");
  };

  /**
   * @param {{name: string, combinable: boolean, maxNumberOfUsages: number, trigger: string, code: string, type: string, amount: number}} discount
   */
  /** @param {any} discount */
  this.newDiscount = function(discount) {
    return this.callApi("/discounts", discount, "POST");
  };

  return this;
};

module.exports = SnipCart;
