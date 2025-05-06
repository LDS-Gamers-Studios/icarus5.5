// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const htmlparse = require("html-to-text");
const Augur = require("augurbot-ts");
const { ButtonStyle } = require("discord.js");

const [approveIdPrefix, rejectIdPrefix] = ["approveMissionMail", "rejectMissionMail"];

const replyRegexes = [
  /^on[^>]*@[^<]*wrote:\n\n>/im,
  /^-+ original message -+$/im,
  /^-+ forwarded message -+$/im
];

const Module = new Augur.Module();

async function loadEmails() {
  const creds = c.google.mail;
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

  const messageIds = await receiver.search({ or: u.db.sheets.missionaries.map((email) => ({ from: email })), seen: false });
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
    const missionaryId = u.db.sheets.missionaries.findKey(address => fromEmail.includes(address));

    // get the server member. if they don't show up, they're probably not a member anymore
    const missionary = Module.client.guilds.cache.get(u.sf.ldsg)?.members.cache.get(missionaryId ?? "");
    if (!missionary) continue;

    // make sure there is text
    if (!parsed.text) {
      if (parsed.html) {
        parsed.text = htmlparse.convert(parsed.html);
      } else {
        parsed.text = parsed.subject;
      }
    }

    if (!parsed.text) continue;
    // trim the reply quote from the bottom if there is one (for some reason it was bypassing email replace)
    for (const regex of replyRegexes) {
      const match = parsed.text.search(regex);
      if (match !== -1) { // it found it!
        parsed.text = parsed.text.substring(0, match);
        break; // Stop after the first match to avoid over-trimming
      }
    }

    parsed.text = parsed.text?.trim();

    // now that we've removed the reply...
    if (!parsed.text) continue;

    const embed = u.embed({ author: missionary })
      .setTitle(`${missionary.displayName} - ${parsed.subject}`)
      .setTimestamp(parsed.receivedDate);

    const embeds = u.pagedEmbedsDescription(embed, parsed.text.replace(fromEmail, missionary.displayName).split("\n"));

    // buttons are handled at the bottom, only the embed gets forwarded. anything for mods but not normies should not go in the embed.
    const approveBtn = new u.Button().setCustomId(approveIdPrefix + embeds.length).setLabel("Approve").setStyle(ButtonStyle.Primary);
    const rejectBtn = new u.Button().setCustomId(rejectIdPrefix + embeds.length).setLabel("Reject").setStyle(ButtonStyle.Danger);
    const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);

    for (const em of embeds) {
      await approvals.send({ embeds: [em] });
    }


    const files = parsed.attachments?.slice(0, 9).map(a => new u.Attachment(a.content).setName(a.fileName ?? a.generatedFileName));

    // pop the question
    await approvals.send({
      content: `Missionary Email from ${missionary.toString()} (\`${fromEmail}\`)`,
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
    await int.editReply("Pulling Emails.");

    const pullCount = await loadEmails();
    int.editReply(`Pulled ${pullCount} Emails`);

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

  if (u.db.sheets.missionaries.has(user.id)) {
    // update db entry
    const entry = u.db.sheets.data.missionaries.find(m => m.get("UserId") === user.id);
    entry?.set("Email", email);
    await entry?.save();
  } else {
    const row = await u.db.sheets.data.docs?.config.sheetsByTitle.Mail.addRow({ "UserId": user.id, "Email": email });
    if (row) u.db.sheets.data.missionaries.push(row);
  }
  u.db.sheets.missionaries.set(user.id, email);

  return int.editReply(`I set ${user}'s email to \`${email}\`.`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRemove(int) {
  const user = int.options.getUser("user", true);

  await u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.delete();
  await u.db.sheets.loadData(int.client, true, true, "missionaries");

  return int.editReply(`${user} has been removed from the mailing list!`);
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryCheck(int) {
  const user = int.options.getUser("user", true);
  const email = u.db.sheets.missionaries.get(user.id);
  if (!email) return int.editReply(`${user} doesn't have a missionary email set!`);
  return int.editReply(`${user} has their missionary email stored as \`${email}\`.`);
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
    const subcommand = int.options.getSubcommand(true);
    await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionary.approvals) });

    switch (subcommand) {
      case "fetch": return slashMissionaryPull(int);
      case "check": return slashMissionaryCheck(int);
      case "register": return slashMissionaryRegister(int);
      case "remove": return slashMissionaryRemove(int);
      default: return u.errorHandler(new Error("Slash Missionary - Unhandled Subcommand"), int);
    }
  }
})
.addEvent("interactionCreate", async (int) => {
  if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;

  if (int.customId.startsWith(approveIdPrefix)) {
    if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to interact with this!", flags: ["Ephemeral"] });

    const embedPages = parseInt(int.customId.substring(approveIdPrefix.length));
    const pagedMessages = await int.channel?.messages.fetch({ before: int.message.id, limit: embedPages });
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

  if (int.customId.startsWith(rejectIdPrefix)) {
    if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to interact with this!", flags: ["Ephemeral"] });

    int.update({ content: int.message.content + `\n\n Rejected by ${int.user}`, components: [] });
    return true;
  }
});

module.exports = Module;