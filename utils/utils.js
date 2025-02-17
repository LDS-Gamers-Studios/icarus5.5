// @ts-check
const { AxiosError } = require("axios");
const Discord = require("discord.js"),
  { escapeMarkdown, ComponentType } = require('discord.js'),
  sf = require("../config/snowflakes.json"),
  tsf = require("../config/snowflakes-testing.json"),
  csf = require("../config/snowflakes-commands.json"),
  db = require("../database/dbControllers.js"),
  p = require('./perms.js'),
  moment = require('moment-timezone'),
  config = require("../config/config.json");

const errorLog = new Discord.WebhookClient({ url: config.webhooks.error });
const { nanoid } = require("nanoid");
/**
 * @typedef ParsedInteraction
 * @property {String | null} command - The command issued, represented as a string.
 * @property {{name: string, value?: string|number|boolean}[]} data - Associated data for the command, such as command options or values selected.
 */

/**
 * Converts an interaction into a more universal format for error messages.
 * @param {Discord.BaseInteraction} int The interaction to be parsed.
 * @returns {ParsedInteraction} The interaction after it has been broken down.
 */
function parseInteraction(int) {
  if (int.isCommand() || int.isAutocomplete()) {
    let command = "";
    /** @type {Record<any, any> & {name: string, value?: string | number | boolean}[]} */
    let data = [];
    if (int.isAutocomplete()) command += "Autocomplete for ";
    if (int.isChatInputCommand()) {
      command += `/${int.commandName}`;
      const sg = int.options.getSubcommandGroup(false);
      const sc = int.options.getSubcommand(false);
      if (sg) {
        command += ` ${sg}`;
        data = int.options.data[0]?.options?.[0]?.options?.map(o => ({ name: o.name, value: o.value })) ?? [];
      }
      if (sc) command += ` ${sc}`;
    } else {
      command = int.commandName;
      data = [...int.options.data];
    }
    return {
      command,
      data: data.map(a => ({ name: a.name, value: a.value }))
    };
  } else if (int.isMessageComponent()) {
    const data = [
      {
        name: "Type",
        value: Discord.ComponentType[int.componentType]
      }
    ];
    if (int.isAnySelectMenu()) {
      data.push({
        name: "Value(s)",
        value: int.values.join(', ')
      });
    }
    return { command: int.customId, data };
  } else if (int.isModalSubmit()) {
    return {
      command: `Modal ${int.customId}`,
      data: int.fields.fields.map(f => ({ name: f.data.label, value: f.value }))
    };
  }
  return { command: null, data: [] };

}

const utils = {
  /**
   * If a command is run in a channel that doesn't want spam, returns #bot-lobby so results can be posted there.
   * @param {Discord.Message} msg The Discord message to check for bot spam.
   * @returns {Discord.TextBasedChannel | null}
   */
  botSpam: function(msg) {
    if (msg.inGuild() && msg.guild.id === utils.sf.ldsg && // Is in server
      ![utils.sf.channels.botSpam, utils.sf.channels.botTesting].includes(msg.channelId) && // Isn't in bot-lobby or bot-testing
      msg.channel.parentId !== utils.sf.channels.team.category) { // Isn't in the moderation category

      msg.reply(`I've placed your results in <#${utils.sf.channels.botSpam}> to keep things nice and tidy in here. Hurry before they get cold!`)
        .then(utils.clean);
      return msg.client.getTextChannel(utils.sf.channels.botSpam);
    }
    return msg.channel;

  },
  /**
   * After the given amount of time, attempts to delete the message.
   * @param {Discord.Message|Discord.APIMessage|Discord.Interaction|Discord.InteractionResponse|null|void} [msg] The message to delete.
   * @param {number} t The length of time to wait before deletion, in milliseconds.
   */
  clean: async function(msg, t = 20000) {
    if (!msg) return;
    await utils.wait(t);
    if (msg instanceof Discord.BaseInteraction) {
      if (msg.isRepliable()) msg.deleteReply().catch(utils.noop);
    } else if ((msg instanceof Discord.Message) && msg.deletable) {
      msg.delete().catch(utils.noop);
    } else if (msg instanceof Discord.InteractionResponse) {
      msg.delete().catch(utils.noop);
    }
  },
  /**
   * Shortcut to Discord.Collection. See docs there for reference.
   */
  Collection: Discord.Collection,

  SelectMenu: {
    String: Discord.StringSelectMenuBuilder,
    StringOption: Discord.StringSelectMenuOptionBuilder,
    User: Discord.UserSelectMenuBuilder,
    Role: Discord.RoleSelectMenuBuilder,
    Channel: Discord.ChannelSelectMenuBuilder,
    Mentionable: Discord.MentionableSelectMenuBuilder
  },
  Attachment: Discord.AttachmentBuilder,
  Button: Discord.ButtonBuilder,
  /** @returns {Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>} */
  MessageActionRow: () => new Discord.ActionRowBuilder(),
  Modal: Discord.ModalBuilder,
  /** @returns {Discord.ActionRowBuilder<Discord.ModalActionRowComponentBuilder>} */
  ModalActionRow: () => new Discord.ActionRowBuilder(),
  TextInput: Discord.TextInputBuilder,
  /**
   * Confirm Dialog
   * @param {Discord.RepliableInteraction<"cached">} interaction The interaction to confirm
   * @param {String} prompt The prompt for the confirmation
   * @returns {Promise<Boolean|null>}
   */
  confirmInteraction: async (interaction, prompt = "Are you sure?", title = "Confirmation Dialog") => {
    const embed = utils.embed({ author: interaction.member ?? interaction.user })
      .setColor(0xff0000)
      .setTitle(title)
      .setDescription(prompt);
    const confirmTrue = utils.customId(),
      confirmFalse = utils.customId();

    const response = {
      embeds: [embed],
      components: [
        utils.MessageActionRow().addComponents(
          new utils.Button().setCustomId(confirmTrue).setEmoji("✅").setLabel("Confirm").setStyle(Discord.ButtonStyle.Success),
          new utils.Button().setCustomId(confirmFalse).setEmoji("⛔").setLabel("Cancel").setStyle(Discord.ButtonStyle.Danger)
        )
      ],
      content: null
    };

    if (interaction.replied || interaction.deferred) await interaction.editReply(response);
    else await interaction.reply({ ...response, ephemeral: true, content: undefined });

    const confirm = await interaction.channel?.awaitMessageComponent({
      filter: (button) => button.user.id === interaction.user.id && (button.customId === confirmTrue || button.customId === confirmFalse),
      componentType: ComponentType.Button,
      time: 60000
    }).catch(() => ({ customId: "confirmTimeout" }));

    if (confirm?.customId === confirmTrue) return true;
    else if (confirm?.customId === confirmFalse) return false;
    return null;
  },
  db: db,
  /**
   * Create an embed from a message
   * @param {Discord.Message} msg The message to turn into an embed
   * @returns {Discord.EmbedBuilder}
   */
  msgReplicaEmbed: (msg, title = "Message", channel = false, files = true) => {
    const embed = utils.embed({ author: msg.member ?? msg.author })
      .setTitle(title || null)
      .setDescription(msg.content || null)
      .setTimestamp(msg.editedAt ?? msg.createdAt);
    if (msg.editedAt) embed.setFooter({ text: "[EDITED]" });
    if (channel) {
      embed.addFields(
        { name: "Channel", value: msg.inGuild() ? `#${msg.channel.name}` : "DMs" },
        { name: "Jump to Post", value: msg.url }
      );
    }
    if (files && msg.attachments.size > 0) embed.setImage(msg.attachments.first()?.url ?? null);
    else if (msg.stickers.size > 0) embed.setImage(msg.stickers.first()?.url ?? null);
    return embed;
  },
  /**
   * Shortcut to nanoid. See docs there for reference.
   */
  customId: nanoid,
  /**
   * Shortcut to Discord.Util.escapeMarkdown. See docs there for reference.
   */
  escapeText: escapeMarkdown,
  /**
   * Returns a MessageEmbed with basic values preset, such as color and timestamp.
   * @param {{author?: Discord.GuildMember|Discord.User|Discord.APIEmbedAuthor|Discord.EmbedAuthorData|null} & Omit<(Discord.Embed | Discord.APIEmbed | Discord.EmbedData), "author">} [data] The data object to pass to the MessageEmbed constructor.
   *   You can override the color and timestamp here as well.
   */
  embed: function(data = {}) {
    const newData = JSON.parse(JSON.stringify(data));
    if (data?.author instanceof Discord.GuildMember || data?.author instanceof Discord.User) {
      newData.author = {
        name: data.author.displayName,
        iconURL: data.author.displayAvatarURL()
      };
    }
    const embed = new Discord.EmbedBuilder(newData);
    if (!data?.color) embed.setColor(parseInt(config.color));
    if (!data?.timestamp) embed.setTimestamp();
    return embed;
  },
  /**
 * @param {Discord.CommandInteraction | Discord.ButtonInteraction | null} int
 * @param {Discord.EmbedBuilder} embed
 * @param {string[]} lines
 */
  pagedEmbeds: async (int, embed, lines, ephemeral = true) => {
    const descriptions = [];
    let active = "";
    lines.forEach((line) => {
      if (active.length + line.length > 4000) {
        descriptions.push(active);
        active = "";
      }
      active += `${line}\n`;
    });
    descriptions.push(active);
    if (!int) return descriptions;
    let i = 0;
    while (i < descriptions.length) {
      const desc = descriptions[i];
      if (!desc) return;
      const e = utils.embed(embed.toJSON()).setDescription(desc);
      if (i === 0) {
        if (int.deferred || int.replied) await int.editReply({ embeds: [e] });
        else await int.reply({ embeds: [e], ephemeral });
      } else {
        await int.followUp({ embeds: [e.setTitle(`${e.data.title ?? ""} Cont.`)], ephemeral });
      }
      i++;
    }
  },
  parseInteraction,
  /**
   * Handles a command exception/error. Most likely called from a catch.
   * Reports the error and lets the user know.
   * @param {Error | null} [error] The error to report.
   * @param {any} message Any Discord.Message, Discord.BaseInteraction, or text string.
   */
  errorHandler: function(error, message = null) {
    if (!error || (error.name === "AbortError")) return;
    /* eslint-disable-next-line no-console*/
    console.error(Date());

    const embed = utils.embed().setTitle(error?.name?.toString() ?? "Error");

    if (message instanceof Discord.Message) {
      const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
      /* eslint-disable-next-line no-console*/
      console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

      message.reply("I've run into an error. I've let my devs know.")
        .then(utils.clean);
      embed.addFields(
        { name: "User", value: message.author.username, inline: true },
        { name: "Location", value: loc, inline: true },
        { name: "Command", value: message.cleanContent || "`No Content`", inline: true }
      );
    } else if (message instanceof Discord.BaseInteraction) {
      const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
      /* eslint-disable-next-line no-console*/
      console.error(`Interaction by ${message.user.username} in ${loc}`);
      if (message.isRepliable() && (message.deferred || message.replied)) message.editReply("I've run into an error. I've let my devs know.").catch(utils.noop).then(utils.clean);
      else if (message.isRepliable()) message.reply({ content: "I've run into an error. I've let my devs know.", ephemeral: true }).catch(utils.noop).then(utils.clean);
      embed.addFields(
        { name: "User", value: message.user?.username, inline: true },
        { name: "Location", value: loc, inline: true }
      );
      const descriptionLines = [];
      const { command, data } = parseInteraction(message);
      if (command) descriptionLines.push(command);
      for (const datum of data) {
        descriptionLines.push(`${datum.name}: ${datum.value}`);
      }
      embed.addFields({ name: "Interaction", value: descriptionLines.join("\n") });
    } else if (typeof message === "string") {
      /* eslint-disable-next-line no-console*/
      console.error(message);
      embed.addFields({ name: "Message", value: message });
    }

    if (error instanceof AxiosError) {
      /* eslint-disable-next-line no-console*/
      console.trace({ name: error.name, code: error.code, message: error.message, cause: error.cause });
    } else {
      /* eslint-disable-next-line no-console*/
      console.trace(error);
    }


    let stack = (error.stack ? error.stack : error.toString());
    if (stack.length > 4096) stack = stack.slice(0, 4000);

    embed.setDescription(stack);
    return errorLog.send({ embeds: [embed] });
  },
  errorLog,
  /**
   * Filter the terms keys by filterTerm and sort by startsWith and then includes
   * @template T
   * @param {string} filterTerm
   * @param {Discord.Collection<string, T>} terms
   * @return {Discord.Collection<string, T>}
   */
  autocompleteSort: (filterTerm, terms) => {
    filterTerm = filterTerm.toLowerCase();
    return terms
      .filter((v, k) => k.toLowerCase().includes(filterTerm))
      .sort((v1, v2, k1, k2) => {
        const aStarts = k1.toLowerCase().startsWith(filterTerm);
        const bStarts = k2.toLowerCase().startsWith(filterTerm);
        if (aStarts && bStarts) return k1.localeCompare(k2);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return k1.localeCompare(k2);
      });
  },
  /**
   * Shortcut to moment with the correct UTC offset (Mountain Time)
   * @param {moment.MomentInput} [input]
   * @param {boolean} [strict]
   */
  moment: (input, strict) => moment(input, strict).tz("America/Denver"),
  /**
   * This task is extremely complicated.
   * You need to understand it perfectly to use it.
   * It took millenia to perfect, and will take millenia
   * more to understand, even for scholars.
   *
   * It does literally nothing.
   * */
  noop: () => {
    // No-op, do nothing
  },
  /**
   * Returns an object containing the command, suffix, and params of the message.
   * @param {Discord.Message} msg The message to get command info from.
   * @param {boolean} clean Whether to use the messages cleanContent or normal content. Defaults to false.
   */
  parse: (msg, clean = false) => {
    for (const prefix of [config.prefix, `<@${msg.client.user.id}>`, `<@!${msg.client.user.id}>`]) {
      const content = clean ? msg.cleanContent : msg.content;
      if (!content.startsWith(prefix)) continue;
      const trimmed = content.substr(prefix.length).trim();
      let [command, ...params] = trimmed.split(" ");
      if (command) {
        let suffix = params.join(" ");
        if (suffix.toLowerCase() === "help") { // Allow `!command help` syntax
          const t = command.toLowerCase();
          command = "help";
          suffix = t;
          params = t.split(" ");
        }
        return {
          command: command.toLowerCase(),
          suffix,
          params
        };
      }
    }
    return null;
  },
  /** Shortcut to utils/perms.js */
  perms: p,
  /**
   * Choose a random element from an array
   * @template K
   * @param {K[]} selections
   * @returns {K}
   */
  rand: function(selections) {
    return selections[Math.floor(Math.random() * selections.length)];
  },
  /**
   * Convert to a fancier time string
   * @param {Date} time The input time
   * @param {Discord.TimestampStylesString} format The format to display in
   * @returns {string} <t:time:format>
   */
  time: function(time, format = "f") {
    return Discord.time(time, format);
  },
  /**
   * Shortcut to snowflakes.json or snowflakes-testing.json depending on if devMode is turned on
   */
  sf: { ...(config.devMode ? tsf : sf), ...csf },

  /**
   * Returns a promise that will fulfill after the given amount of time.
   * If awaited, will block for the given amount of time.
   * @param {number} t The time to wait, in milliseconds.
   */
  wait: function(t) {
    return new Promise((fulfill) => {
      setTimeout(fulfill, t);
    });
  },
  /**
   * @template T
   * @param {T[]} items
   * @returns {T[]}
   */
  unique: function(items) {
    return Array.from(new Set(items));
  },
  /**
   * @template T
   * @param {T[]} items
   * @param {keyof T} key
   * @returns {T[]}
   */
  uniqueObj: function(items, key) {
    const col = new Discord.Collection(items.map(i => [i[key], i]));
    return Array.from(col.values());
  },
  /** @param {Discord.GuildMember | null} [member]*/
  getHouseInfo: function(member) {
    const houseInfo = new Map([
      [utils.sf.roles.houses.housebb, { name: "Brightbeam", color: 0x00a1da }],
      [utils.sf.roles.houses.housefb, { name: "Freshbeast", color: 0xfdd023 }],
      [utils.sf.roles.houses.housesc, { name: "Starcamp", color: 0xe32736 }]
    ]);

    if (member) {
      for (const [k, v] of houseInfo) {
        if (member.roles.cache.has(k)) return v;
      }
    }
    return { name: "Unsorted", color: 0x402a37 };
  }
};

module.exports = utils;
