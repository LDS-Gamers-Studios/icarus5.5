// @ts-check
const Discord = require("discord.js"),
  { escapeMarkdown, ComponentType } = require('discord.js'),
  sf = require("../config/snowflakes.json"),
  tsf = require("../config/snowflakes-testing.json"),
  csf = require("../config/snowflakes-commands.json"),
  db = require("../database/dbControllers.js"),
  p = require('./perms.js'),
  moment = require('moment'),
  config = require("../config/config.json");

const errorLog = new Discord.WebhookClient({ url: config.webhooks.error });
const { nanoid } = require("nanoid");

/**
 * @typedef ParsedInteraction
 * @property {String | null} command - The command issued, represented as a string.
 * @property {{name: string, value: string|number|boolean|undefined}[]} data - Associated data for the command, such as command options or values selected.
 */

/**
 * Converts an interaction into a more universal format for error messages.
 * @param {Discord.BaseInteraction} int The interaction to be parsed.
 * @returns {ParsedInteraction} The interaction after it has been broken down.
 */
function parseInteraction(int) {
  if (int.isCommand() || int.isAutocomplete()) {
    let command = "";
    if (int.isAutocomplete()) command += "Autocomplete for ";
    if (int.isChatInputCommand()) {
      command += `/${int.commandName}`;
      const sg = int.options.getSubcommandGroup(false);
      const sc = int.options.getSubcommand(false);
      command += int.commandName;
      if (sg) command += ` ${sg}`;
      if (sc) command += ` ${sc}`;
    }
    return {
      command,
      data: int.options.data.map(a => ({ name: a.name, value: a.value }))
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
  } else {
    return { command: null, data: [] };
  }
}

const utils = {
  /**
   * If a command is run in a channel that doesn't want spam, returns #bot-lobby so results can be posted there.
   * @param {Discord.Message} msg The Discord message to check for bot spam.
   * @returns {Discord.TextBasedChannel | null}
   */
  botSpam: function(msg) {
    if (msg.inGuild() && msg.guild.id === utils.sf.ldsg && // Is in server
      ![utils.sf.channels.botspam, utils.sf.channels.bottesting].includes(msg.channelId) && // Isn't in bot-lobby or bot-testing
      msg.channel.parentId !== utils.sf.channels.staffCategory) { // Isn't in the moderation category

      msg.reply(`I've placed your results in <#${utils.sf.channels.botspam}> to keep things nice and tidy in here. Hurry before they get cold!`)
        .then(utils.clean);
      return msg.client.getTextChannel(utils.sf.channels.botspam);
    } else {
      return msg.channel;
    }
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
    else return null;
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
   * Handles a command exception/error. Most likely called from a catch.
   * Reports the error and lets the user know.
   * @param {Error | null} [error] The error to report.
   * @param {any} message Any Discord.Message, Discord.BaseInteraction, or text string.
   */
  errorHandler: function(error, message = null) {
    if (!error || (error.name === "AbortError")) return;

    console.error(Date());

    const embed = utils.embed().setTitle(error?.name?.toString() ?? "Error");

    if (message instanceof Discord.Message) {
      const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
      console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

      message.channel.send("I've run into an error. I've let my devs know.")
        .then(utils.clean);
      embed.addFields(
        { name: "User", value: message.author.username, inline: true },
        { name: "Location", value: loc, inline: true },
        { name: "Command", value: message.cleanContent || "`undefined`", inline: true }
      );
    } else if (message instanceof Discord.BaseInteraction) {
      const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
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
      console.error(message);
      embed.addFields({ name: "Message", value: message });
    }

    console.trace(error);

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
   * Shortcut to moment with the correct UTC offset (MST)
   * @param {moment.MomentInput} [input]
   * @param {boolean} [strict]
   */
  moment: (input, strict) => moment(input, strict).utcOffset(-7),
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
    return [...new Set(items)];
  }
};

module.exports = utils;
