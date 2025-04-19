// @ts-check

const Augur = require("augurbot-ts"),
  u = require('../utils/utils'),
  Discord = require("discord.js"),
  petPetGif = require('pet-pet-gif'),
  Jimp = require("jimp"),
  { ColorActionName } = require("@jimp/plugin-color");

/**
 * @callback filterFunction
 * @param {Discord.ChatInputCommandInteraction} int
 * @param {{name: string, img: Jimp}} img
 *
 * @callback process
 * @param {number} x
 * @param {number} y
 * @param {Jimp} canvas
 * @param {number} index
 */

/** @param {Discord.ChatInputCommandInteraction} int*/
const errorReading = (int) => int.editReply("Sorry, but I couldn't get the image. Let my developers know if this is a reoccurring problem").then(u.clean);


/** @param {string | null} url */
async function jimpRead(url) {
  try {
    if (!url) return null;
    const img = await Jimp.read(url);
    // resize large images so that the largest dimension is 256p
    if (img.getWidth() > 256 || img.getHeight() > 256) {
      const w = img.getWidth(), h = img.getHeight();
      const largest = Math.max(w, h);
      img.resize(w === largest ? 256 : Jimp.AUTO, w === largest ? Jimp.AUTO : 256);
    }
    return img;
  } catch (e) {
    return null;
  }
}

/**
 * Send the image as an embed
 * @param {Discord.ChatInputCommandInteraction} int
 * @param {Buffer | String} img
 * @param {String} name
 * @param {String} format
 */
async function sendImg(int, img, name, format = "png") {
  const image = new u.Attachment(img, { name: `image.${format}` });
  const embed = u.embed().setTitle(name).setImage(`attachment://image.${format}`);
  return int.editReply({ embeds: [embed], files: [image] });
}

/**
 * Get the image from an interaction.
 * @param {Discord.ChatInputCommandInteraction} int
 * @param {Discord.ImageSize} size size of the image
 * @returns {{ image: string, name: string}} image url
 */
function targetImg(int, size = 256) {
  /** @type {Discord.GuildMember | Discord.User | null} */
  let target;
  if (int.inCachedGuild()) target = int.options.getMember("user");
  target ??= int.options.getUser("user") ?? int.user;
  return { image: target.displayAvatarURL({ extension: 'png', size }), name: target.displayName };
}

/**
 * Apply a filter function with parameters. Useful for when there isn't much logic to it
 * @param {Discord.ChatInputCommandInteraction} int
 * @param {string} filter filter to apply
 * @param {{name: string, img: Jimp}} image
 * @param {Record<any, any> | number[]} [params] array of params to pass into the filter function
 */
async function basicFilter(int, image, filter, params) {
  const { name, img } = image;
  // @ts-ignore
  if (params) img[filter.toLowerCase()](...params);
  // @ts-ignore
  else img[filter.toLowerCase()]();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `${filter} ${name}`);
}

/**
 * For filters like andywarhol and popart, where the image gets pasted 4 times with a bit of space in-between.
 * `run` will be called 4 times and provides an index
 * @param {Jimp} img the base image
 * @param {number} o offest (default 12)
 * @param {process} run the process to run (x, y, canvas, index)
 * @returns {Jimp}
 */
function fourCorners(img, o = 12, run) {
  const width = img.getWidth(),
    height = img.getHeight(),
    canvas = new Jimp(width * 2 + (o * 3), height * 2 + (o * 3), 0xffffffff),
    positions = [[o, o], [width + (o * 2), o], [o, height + (o * 2)], [width + (o * 2), height + (o * 2)]];

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    run(p[0], p[1], canvas, i);
  }
  return canvas;
}

/** @type {filterFunction} */
async function andywarhol(int, image) {
  const { name, img } = image;
  const output = await fourCorners(img, 12, (x, y, c) => {
    img.color([{ apply: ColorActionName.SPIN, params: [60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Andywarhol ${name}`);
}

/** @type {filterFunction} */
async function colorme(int, image) {
  const { name, img } = image;
  const color = u.rand([45, 90, 135, 180]);
  const output = await img.color([{ apply: ColorActionName.HUE, params: [color] }]).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Colorize ${name} (Hue: ${color})`);
}

/** @type {filterFunction} */
async function deepfry(int, image) {
  const { name, img } = image;
  const output = await img.posterize(20)
    .color([{ apply: ColorActionName.SATURATE, params: [100] }])
    .contrast(1)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Deepfry ${name}`);
}

/** @type {filterFunction} */
async function flex(int, image) {
  const { name, img } = image;
  const right = await Jimp.read("./media/flexArm.png");
  const left = right.clone().flip(true, Math.random() > 0.5);
  right.flip(false, Math.random() > 0.5);
  const canvas = new Jimp(368, 128, 0x00000000);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(left, 0, 4)
    .blit(right, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Flex ${name}`);
}

/** @type {filterFunction} */
async function metal(int, image) {
  const { name, img } = image;
  const right = await Jimp.read('./media/metalHand.png');
  const left = right.clone().flip(true, false);
  const canvas = new Jimp(368, 128, 0x00000000);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(right, 0, 4)
    .blit(left, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Metal ${name}`);
}

/** @type {filterFunction} */
async function personal(int, image) {
  const { name, img } = image;
  const canvas = await Jimp.read('./media/personalBase.png');
  img.resize(350, 350);
  if (!img.hasAlpha()) img.circle();
  const output = await canvas.blit(img, 1050, 75).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `${name} took that personally`);
}

/**
 * @param {Discord.ChatInputCommandInteraction} int
 */
async function petpet(int) {
  const target = targetImg(int);
  const gif = await petPetGif(target.image);
  return await sendImg(int, gif, `Petpet ${target.name}`, "gif");
}

/** @type {filterFunction} */
async function popart(int, image) {
  const { name, img } = image;
  const output = await fourCorners(img, 12, (x, y, c, i) => {
    if (i === 0) img.color([{ apply: ColorActionName.DESATURATE, params: [100] }, { apply: ColorActionName.SATURATE, params: [50] }]);
    else img.color([{ apply: ColorActionName.SPIN, params: [i === 3 ? 120 : 60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Popart ${name}`);
}

/**
 * @param {Discord.ChatInputCommandInteraction} int
*/
async function avatar(int) {
  const targetImage = targetImg(int);
  if (!targetImage) return errorReading(int);
  const format = targetImage.image.includes('.gif') ? 'gif' : 'png';
  return await sendImg(int, targetImage.image, (targetImage.name), format);
}

const Module = new Augur.Module()
.addInteraction({
  name: "avatar",
  id: u.sf.commands.slashAvatar,
  options: { registry: "slashAvatar" },
  process: async (interaction) => {
    await interaction.deferReply();

    const url = targetImg(interaction);
    const img = await jimpRead(url.image);
    if (!img) return errorReading(interaction);
    const i = { name: url.name, img };
    switch (interaction.options.getString('filter')) {
      case "andywarhol": return andywarhol(interaction, i);
      case "colorme": return colorme(interaction, i);
      case "deepfry": return deepfry(interaction, i);
      case "flex": return flex(interaction, i);
      case "metal": return metal(interaction, i);
      case "personal": return personal(interaction, i);
      case "petpet": return petpet(interaction);
      case "popart": return popart(interaction, i);

      // basic filters
      case "fisheye": return basicFilter(interaction, i, 'Fisheye');
      case "invert": return basicFilter(interaction, i, 'Invert');
      case "blur": return basicFilter(interaction, i, 'Blur', [5]);
      case "blurple": return basicFilter(interaction, i, 'Color', [[{ apply: "desaturate", params: [100] }, { apply: "saturate", params: [47.7] }, { apply: "hue", params: [227] }]]);
      case "grayscale": return basicFilter(interaction, i, 'Color', [[{ apply: "desaturate", params: [100] }]]);

      default: return avatar(interaction);
    }
  }
});
module.exports = Module;