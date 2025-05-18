// @ts-check
const u = require("../utils/utils");
const config = require("../config/config.json");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const htmlparse = require("html-to-text");
const Augur = require("augurbot-ts");
const Discord = require("discord.js");

const [approveIdPrefix, rejectIdPrefix] = ["approveMissionMail", "rejectMissionMail"];

const replyRegexes = [
  /^on[^>]*@[^>]*>(?: |\n)wrote:\n\n>/im,
  /^-+ original message -+$/im,
  /^-+ forwarded message -+$/im
];

const Module = new Augur.Module();

async function loadEmails() {
  const creds = config.google.mail;
  if (!creds.enabled) return "<FEATURE DISABLED>";
  try {
    const receiver = new receive.ImapFlow({
      auth: {
        user: creds.email,
        pass: creds.pass
      },
      host: 'imap.gmail.com',
      port: 993,
      logger: false
    });

    await receiver.connect();
    await receiver.mailboxOpen("INBOX");

    const sent = await sendUnsent(receiver);
    receiver.close();

    return sent;
  } catch (error) {
    u.errorHandler(error, "Loading Emails");
  }
}

/**
 * @param {receive.ImapFlow} receiver
 * @returns {Promise<number>}
 */
async function sendUnsent(receiver) {
  if (!receiver.usable) throw new Error("Missionary Email Receiver not usable, cannot check for new emails.");

  const messageIds = await receiver.search({ or: u.db.sheets.missionaries.map((m) => ({ from: m.email })), seen: false, since: u.moment().subtract(1, "week").toDate() });
  const messages = await receiver.fetchAll(messageIds, { source: true });

  const approvals = Module.client.getTextChannel(u.sf.channels.missionary.approvals);
  if (!approvals) throw new Error("unable to find approval channel for missionary emails.");

  for (const rawMsg of messages) {

    // parse the email source into readable stuff
    /** @type {interpret.ParsedEmail} */
    const parsed = await new Promise((res) => {
      const parser = new interpret.MailParser();
      parser.on("end", result => res(result));
      parser.write(rawMsg.source);
      parser.end();
    });

    // figure out who it is from
    const fromEmail = parsed.from?.[0].address ?? "Err:NoFromAddress";
    const missionary = u.db.sheets.missionaries.find(m => fromEmail.includes(m.email));

    // get the server member. if they don't show up, they're probably not a member anymore
    const user = Module.client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(missionary?.userId ?? "");
    if (!user) continue;

    // make sure there is text
    if (!parsed.text) {
      if (parsed.html) {
        parsed.text = htmlparse.convert(parsed.html);
      } else {
        parsed.text = parsed.subject;
      }
    }

    if (!parsed.text && parsed.attachments?.length === 0) continue;

    // trim the reply quote from the bottom if there is one (for some reason it was bypassing email replace)
    if (parsed.text) {
      for (const regex of replyRegexes) {
        const match = parsed.text?.search(regex);
        if (match !== -1) { // it found it!
          parsed.text = parsed.text?.substring(0, match);
          break; // Stop after the first match to avoid over-trimming
        }
      }

      parsed.text = parsed.text?.trim();
    }

    // now that we've removed the reply...
    if (!parsed.text && parsed.attachments?.length === 0) continue;

    const text = parsed.text?.replace(fromEmail, user.displayName)
      .replace(/\n(\n|[a-z])/g, " $1")
      .split("\n");

    const embed = u.embed({ author: user })
      .setTitle(`${user.displayName} - ${parsed.subject}`)
      .setTimestamp(parsed.receivedDate);

    const embeds = text ? u.pagedEmbedsDescription(embed, text) : [embed.setDescription("Attachments:")];

    for (const em of embeds) {
      await approvals.send({ embeds: [em] });
    }

    // buttons are handled at the bottom, only the embed gets forwarded. anything for mods but not normies should not go in the embed.
    const approveBtn = new u.Button().setCustomId(approveIdPrefix + embeds.length).setLabel("Approve").setStyle(Discord.ButtonStyle.Primary).setEmoji("✅");
    const rejectBtn = new u.Button().setCustomId(rejectIdPrefix).setLabel("Reject").setStyle(Discord.ButtonStyle.Danger).setEmoji("🗑️");
    const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);

    const files = parsed.attachments?.slice(0, 9).map(a => new u.Attachment(a.content).setName(a.fileName ?? a.generatedFileName));

    // pop the question
    await approvals.send({
      content: `Missionary Email from ${user.toString()} (\`${fromEmail}\`)`,
      files,
      components: [actionRow]
    });
  }
  await receiver.messageFlagsAdd(messageIds, ["\\seen"]);
  return messages.length;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryPull(int) {
  try {
    const pullCount = await loadEmails();
    int.editReply(`Pulled ${pullCount} Email(s)`);
  } catch (error) {
    u.errorHandler(error, "slashMissionaryPull");
    return await int.editReply("Error pulling emails.");
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRegister(int) {
  const user = int.options.getUser("user", true);
  const email = int.options.getString("email", true);

  if (!email.endsWith("@missionary.org")) return int.editReply("Missionary emails must end with `@missionary.org`");
  await u.db.sheets.missionaries.update({ email, userId: user.id });

  return int.editReply(`I set ${user}'s email to \`${email}\`.`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRemove(int) {
  const user = int.options.getUser("user", true);

  if (!u.db.sheets.missionaries.has(user.id)) return int.editReply(`${user} doesn't have a missionary email set up!`);

  u.db.sheets.missionaries.delete(user.id);
  await u.db.sheets.missionaries.rows.find((row) => row.get("UserId") === user.id)?.delete();

  return int.editReply(`${user} has been removed from the mailing list!`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryList(int) {
  const missionaries = u.db.sheets.missionaries.map((m) => {
    const member = int.guild.members.cache.get(m.userId);
    if (!member) return `<@${m.userId}> (${m.userId}, unknown user): **${m.email}**`;
    return `${member} (${member.displayName}): **${m.email}**`;
  });
  const embed = u.embed().setTitle("Missionary Emails")
    .setDescription(`I have the following missionary emails stored:\n\n${missionaries.join("\n")}`);

  return int.editReply({ embeds: [embed] });
}

Module
.setInit(loadEmails)
.setClockwork(() => {
  return setInterval(loadEmails, 24 * 60 * 60_000);
})
.addInteraction({
  name: "missionary",
  id: u.sf.commands.slashMissionary,
  onlyGuild: true,
  hidden: true,
  permissions: (int) => u.perms.calc(int.member, ["mod"]),
  process: async (int) => {
    await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionary.approvals) });

    switch (int.options.getSubcommand(true)) {
      case "fetch": return slashMissionaryPull(int);
      case "register": return slashMissionaryRegister(int);
      case "remove": return slashMissionaryRemove(int);
      case "list": return slashMissionaryList(int);
      default: return u.errorHandler(new Error("Slash Missionary - Unhandled Subcommand"), int);
    }
  }
})
.addEvent("interactionCreate", async (int) => {
  try {
    if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;

    if (int.customId.startsWith(approveIdPrefix)) {
      if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to interact with this!", flags: ["Ephemeral"] });

      const embedCount = parseInt(int.customId.substring(approveIdPrefix.length));
      const pagedMessages = await int.channel?.messages.fetch({ before: int.message.id, limit: embedCount + 10 })
        .then((/** @type {Discord.Collection<String, Discord.Message<true>>} */ msgs) => msgs.filter(m => m.author.id === int.client.user.id).first(embedCount));

      if (!pagedMessages) return int.reply({ content: "I couldn't find the messages to forward!" });

      await int.update({ content: int.message.content + `\n\nApproved by ${int.user}`, components: [] });

      for (const message of pagedMessages.reverse().values()) {
        await int.client.getTextChannel(u.sf.channels.missionary.mail)?.send({ embeds: message.embeds, files: [...message.attachments.values()] });
      }

      if (int.message.embeds.length > 0 || int.message.attachments.size > 0) {
        int.client.getTextChannel(u.sf.channels.missionary.mail)?.send({ embeds: int.message.embeds, files: [...int.message.attachments.values()] });
      }
      return true;
    }

    if (int.customId === rejectIdPrefix) {
      if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to interact with this!", flags: ["Ephemeral"] });

      int.update({ content: int.message.content + `\n\n Rejected by ${int.user}`, components: [] });
      return true;
    }
  } catch (error) {
    u.errorHandler(error, `Mission Mail Button ${int.isButton() ? int.customId : ""}`);
  }
});

module.exports = Module;