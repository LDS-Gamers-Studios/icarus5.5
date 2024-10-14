// @ts-check
const u = require("./regUtils");

module.exports = new u.cmd()
  .setName("tournaments")
  .setDescription("Get a list of tournaments in the server.")
  .setDMPermission(false)
  .toJSON();