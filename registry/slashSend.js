// @ts-check
const u = require('./regUtils'),
  avatars = require("../utils/avatarHandler");

const category = new u.string()
  .setName("category")
  .setDescription("a category of persona whether manual, normal, or a category of premade")
  .setRequired(true)
  .setChoices(
    { name: "Normal", value: "Normal" },
    { name: "Manual", value: "Manual" });

const categorys = {};

for (const subcategory in avatars.sendAvatars) {
  const theseAvatars = avatars.sendAvatars[subcategory];
  // add category option
  category.addChoices(
    { name: subcategory, value: subcategory }
  );
  // create the input
  categorys[subcategory] = new u.string()
  .setName(subcategory)
  .setDescription("a premade persona selection from the " + subcategory + "category of personas")
  .setRequired(false);
  const thiscategory = categorys[subcategory];
  for (const avatar in theseAvatars) {
    // add all of the choices for that input
    thiscategory.addChoices(
      { name: theseAvatars[avatar].id, value: theseAvatars[avatar].id }
    );
  }
}


const pfp = new u.string()
  .setName("pfp")
  .setDescription("what profile pic to use while sending")
  .setRequired(false);

const nick = new u.string()
  .setName("nick")
  .setDescription("what name to use while sending it")
  .setRequired(false);

const content = new u.string()
  .setName("content")
  .setDescription("content of the message to send")
  .setRequired(true);

// eslint-disable-next-line prefer-const
let command = new u.cmd()
  .setName("send")
  .setDescription("have the bot say something for you (perhaps with disguise?)")
  .addStringOption(content)
  .addStringOption(category)
  .addStringOption(pfp)
  .addStringOption(nick);
for (const categoryID in categorys) {
  command.addStringOption(categorys[categoryID]);
}
module.exports = command
.setContexts([0, 1, 2])
.toJSON();
