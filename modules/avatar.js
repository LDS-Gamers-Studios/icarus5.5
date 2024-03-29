// @ts-check

const Augur = require("augurbot-ts"),
  u = require('../utils/utils'),
  discord = require("discord.js"),
  petPetGif = require('pet-pet-gif'),
  Jimp = require("jimp"),
  { ColorActionName } = require("@jimp/plugin-color");

/**
 * @callback filterFunction
 * @param {discord.ChatInputCommandInteraction} int
 * @param {Jimp} img
 * @returns {Promise<any>}
 *
 * @callback process
 * @param {number} x
 * @param {number} y
 * @param {Jimp} canvas
 * @param {number} index
 */

/** @param {discord.ChatInputCommandInteraction} int*/
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
      img.resize(w == largest ? 256 : Jimp.AUTO, w == largest ? Jimp.AUTO : 256);
    }
    return img;
  } catch (e) {
    u.errorHandler(e);
    return null;
  }
}

/**
 * Send the image as an embed
 * @param {discord.ChatInputCommandInteraction} int
 * @param {Buffer | String} img
 * @param {String} name
 * @param {String} format
 * @returns {Promise<any>}
 */
async function sendImg(int, img, name, format = "png") {
  const file = int.options.getAttachment('file');
  const target = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  const both = Boolean(file && target);
  const image = u.attachment().setFile(img).setName(`image.${format}`);
  const embed = u.embed().setTitle(name).setImage(`attachment://${image.name}`).setFooter(both ? { text: "you provided both a user and a file, so I defaulted to using the file" } : null);
  return int.editReply({ embeds: [embed], files: [image] });
}

/**
 * Get the image from an interaction.
 * @param {discord.ChatInputCommandInteraction} int
 * @param {number} size size of the image
 * @returns {Promise<string | null>} image url
 */
async function targetImg(int, size = 256) {
  if (int.options.getAttachment('file')) {
    const url = int.options.getAttachment('file', true).url;
    if (!await jimpRead(url)) return null;
    else return url;
  }
  const target = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  return target.displayAvatarURL({ extension: 'png', size, dynamic: true });
}

/**
 * Apply a filter function with parameters. Useful for when there isn't much logic to it
 * @param {discord.ChatInputCommandInteraction} int
 * @param {string} filter filter to apply
 * @param {any[]?} params array of params to pass into the filter function
 */
async function basicFilter(int, img, filter, params) {
  if (params) img[filter](...params);
  else img[filter]();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, filter);
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
async function andywarhol(int, img) {
  const output = await fourCorners(img, 12, (x, y, c) => {
    img.color([{ apply: ColorActionName.SPIN, params: [60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Andywarhol");
}

/** @type {filterFunction} */
async function colorme(int, img) {
  const color = Math.floor(Math.random() * 359);
  const output = await img.color([{ apply: ColorActionName.HUE, params: [color] }]).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, `Colorize Hue: ${color}`);
}

/** @type {filterFunction} */
async function deepfry(int, img) {
  const output = await img.posterize(20)
    .color([{ apply: ColorActionName.SATURATE, params: [100] }])
    .contrast(1)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Deepfry");
}

/** @type {filterFunction} */
async function flex(int, img) {
  const right = await Jimp.read("./media/flexArm.png");
  const left = right.clone().flip(true, Math.random() > 0.5);
  const canvas = new Jimp(368, 128, 0x00000000);
  right.flip(false, Math.random() > 0.5);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(left, 0, 4)
    .blit(right, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Flex");
}

/** @type {filterFunction} */
async function metal(int, img) {
  const right = await Jimp.read('./media/metalHand.png');
  const left = right.clone().flip(true, false);
  const canvas = new Jimp(368, 128, 0x00000000);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(right, 0, 4)
    .blit(left, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Metal");
}

/** @type {filterFunction} */
async function personal(int, img) {
  const canvas = await Jimp.read('./media/personalBase.png');
  img.resize(350, 350);
  if (!img.hasAlpha()) img.circle();
  const output = await canvas.blit(img, 1050, 75).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Personal");
}

/**
 * @param {discord.ChatInputCommandInteraction} int
 * @returns {Promise<any>}
 */
async function petpet(int) {
  const gif = await petPetGif(await targetImg(int));
  return await sendImg(int, gif, "Petpet", "gif");
}

/** @type {filterFunction} */
async function popart(int, img) {
  const output = await fourCorners(img, 12, (x, y, c, i) => {
    if (i == 0) img.color([{ apply: ColorActionName.DESATURATE, params: [100] }, { apply: ColorActionName.SATURATE, params: [50] }]);
    else img.color([{ apply: ColorActionName.SPIN, params: [i == 3 ? 120 : 60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await sendImg(int, output, "Popart");
}

/**
 * @param {discord.ChatInputCommandInteraction} int
*/
async function avatar(int) {
  const targetImage = await targetImg(int);
  if (!targetImage) return errorReading(int);
  const targetUser = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  const format = targetImage?.includes('.gif') ? 'gif' : 'png';
  return await sendImg(int, targetImage, (targetUser.displayName ?? targetUser.username), format);
}

const Module = new Augur.Module()
.addInteraction({
  name: "avatar",
  id: u.sf.commands.slashAvatar,
  process: async (interaction) => {
    const file = interaction.options.getAttachment('file');
    if (file && !interaction.options.getString('filter')) return interaction.reply({ content: "You need to specify a filter to apply if you're uploading a file", ephemeral: true });
    if (file && file.size > 4000000) return interaction.reply({ content: "That file is too big for me to process! It needs to be under 4MB.", ephemeral: true });
    if (file && file.contentType?.includes('image/webp')) return interaction.reply({ content: "Sorry, webp files are not supported at this time", ephemeral: true });
    await interaction.deferReply();
    const img = await jimpRead(await targetImg(interaction));
    if (!img) return errorReading(interaction);

    switch (interaction.options.getString('filter')) {
    case "andywarhol": return andywarhol(interaction, img);
    case "colorme": return colorme(interaction, img);
    case "deepfry": return deepfry(interaction, img);
    case "flex": return flex(interaction, img);
    case "metal": return metal(interaction, img);
    case "personal": return personal(interaction, img);
    case "petpet": return petpet(interaction);
    case "popart": return popart(interaction, img);

    // basic filters
    case "fisheye": return basicFilter(interaction, img, 'fisheye', null);
    case "invert": return basicFilter(interaction, img, 'invert', null);
    case "blur": return basicFilter(interaction, img, 'blur', [5]);
    case "flipx": return basicFilter(interaction, img, 'flip', [true, false]);
    case "flipy": return basicFilter(interaction, img, 'flip', [false, true]);
    case "flipxy": return basicFilter(interaction, img, 'flip', [true, true]);
    case "blurple": return basicFilter(interaction, img, 'color', [[{ apply: "desaturate", params: [100] }, { apply: "saturate", params: [47.7] }, { apply: "hue", params: [227] }]]);
    case "grayscale": return basicFilter(interaction, img, 'color', [[{ apply: "desaturate", params: [100] }]]);

    default: return avatar(interaction);
    }
  }
});
module.exports = Module;