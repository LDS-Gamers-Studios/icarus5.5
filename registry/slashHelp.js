// @ts-check
const u = require('./regUtils');

module.exports = new u.cmd()
  .setName("help")
  .setDescription("Get a list of commands and custom tags in the server.")
  .toJSON();