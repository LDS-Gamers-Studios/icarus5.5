// @ts-check
const u = require('./regUtils');

const user = new u.user()
  .setName("user")
  .setDescription("The user whose avatar you want to see")
  .setRequired(false);

const filter = new u.string()
  .setName("filter")
  .setDescription("Apply a filter to the avatar")
  .setRequired(false)
  .setChoices(
    { name: "Andy Warhol", value: "andywarhol" },
    { name: "Blur", value: "blur" },
    { name: "Colorize", value: "colorme" },
    { name: "Deepfry", value: "deepfry" },
    { name: "Fisheye Lens", value: "fisheye" },
    { name: "Flex", value: "flex" },
    { name: "Flip Both", value: "flipxy" },
    { name: "Flip Horizontal", value: "flipx" },
    { name: "Flip Vertical", value: "flipy" },
    { name: "Grayscale", value: "grayscale" },
    { name: "Invert", value: "invert" },
    { name: "Metal", value: "metal" },
    { name: "Personal", value: "personal" },
    { name: "Petpet", value: "petpet" },
    { name: "Pop Art", value: "popart" }
  );

const reshade = new u.string()
  .setName("reshade")
  .setDescription("Change the dominant color in the image")
  .setRequired(false)
  .setChoices(
    { name: "Red", value: "red" },
    { name: "Orange", value: "orange" },
    { name: "Yellow", value: "yellow" },
    { name: "Green", value: "green" },
    { name: "Blue", value: "blue" },
    { name: "Purple", value: "purple" },
    { name: "Violet", value: "violet" },
    { name: "Magenta", value: "magenta" },
    { name: "Maroon", value: "maroon" },
    { name: "Cyan", value: "cyan" },
    { name: "Fuchsia", value: "fuchsia" },
    { name: "Ocean Blue", value: "oceanblue" },
    { name: "Spring Green", value: "springgreen" },
    { name: "Blurple", value: "blurple" }
  );

module.exports = new u.cmd()
  .setName("avatar")
  .setDescription("See someone's avatar or apply a filter to it.")
  .addUserOption(user)
  .addStringOption(filter)
  .addStringOption(reshade)
  .setDMPermission(false)
  .toJSON();
