// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const htmlparse = require("html-to-text");
const Augur = require("augurbot-ts");
const { ChannelType, ButtonStyle } = require("discord.js");
const [approveIdPrefix, rejectIdPrefix] = ["approvemissionmail", "rejectmissionmail"];

const replyRegexes = [
  // /^on[\s\n\r]+.+wrote:[\s\n\r]*$/im,
  // /on[\s\n\r]+.+wrote:[\s\n\r]*/im,
  /^on[^>]*@[^<]*wrote:\n\n>/im,
  // /^on\s.+wrote:\s*$/im, :(){:|:&};:
  // /On\s.+wrote:\s*/im,
  /^>.*$/m,
  /^-+ original message -+$/m,
  /^from:.*$/m,
  /^sent:.*$/m,
  /^to:.*$/m,
  /^subject:.*$/m,
  /^date:.*$/m
];

const Module = new Augur.Module();

async function logNPull() {
  const creds = c.google.mail;
  try {
    const receiver = new receive.ImapFlow({
      auth: {
        user: creds.email,
        pass: creds.gAccountAppPass
      },
      host: 'imap.gmail.com',
      port: 993,
      logger: false
    });

    await receiver.connect();
    await receiver.mailboxOpen("INBOX");

    const sent = await sendUnsent(receiver);
    // receiver.close();
    return sent;
  } catch (error) {
    u.errorHandler(error, `login & pull missionmail`);
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

  for (const rawMsg of messages) {

    // parse the email source into readable stuff
    /** @type {interpret.ParsedEmail} */
    const parsed = await new Promise((resolve) => {
      const parser = new interpret.MailParser();
      parser.on("end", result => resolve(result));
      parser.write(rawMsg.source);
      parser.end();
    });

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
      const match = parsed.text.toLowerCase().search(regex);
      if (match !== -1) { // it found it!
        parsed.text = parsed.text.substring(0, match);
        break; // Stop after the first match to avoid over-trimming
      }
    }
    parsed.text = parsed.text?.trim();

    // now that we've removed the reply...
    if (!parsed.text) continue;

    // figure out who it is from
    const fromEmail = parsed.from ? parsed.from[0].address : "Err:NoFromAddress";
    const missionaryId = u.db.sheets.missionaries.findKey(address => fromEmail?.includes(address) ? address : false);

    // get some discord side of things stuff
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    const missionary = ldsg?.members.cache.get(missionaryId ?? "");
    if (!missionary || !ldsg) {
      // still need this in case the filter fails or they aren't a member anymore.
      continue;
    }

    const missionMailApprovals = ldsg.channels.cache.get(u.sf.channels.missionary.approvals);
    if (!missionMailApprovals || missionMailApprovals.type !== ChannelType.GuildText) throw new Error("unable to find approval channel for missionary emails.");

    const embed = u.embed({ author: missionary })
      .setTitle(`${missionary.displayName} - ${parsed.subject}`)
      .setTimestamp(parsed.receivedDate);

    const embeds = u.pagedEmbedsDescription(embed, parsed.text.replace(fromEmail, missionary.displayName).split("\n"));

    // buttons are handled at the bottom, only the embed gets forwarded. anything for mods but not normies should not go in the embed.
    const approveBtn = new u.Button().setCustomId(approveIdPrefix + embeds.length).setLabel("Approve").setStyle(ButtonStyle.Primary);
    const rejectBtn = new u.Button().setCustomId(rejectIdPrefix + embeds.length).setLabel("Reject").setStyle(ButtonStyle.Danger);
    const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);

    for (const em of embeds) {
      await missionMailApprovals.send({ embeds: [em] });
    }


    const files = parsed.attachments?.slice(0, 9).map(a => new u.Attachment(a.content).setName(a.fileName ?? a.generatedFileName));

    // pop the question
    await missionMailApprovals.send({
      content: `incoming missionary email from ${missionary.toString()}(\`${fromEmail}\`)`,
      files,
      components: [actionRow]
    });
  }
  receiver.messageFlagsAdd(messageIds, ["\\seen"]);
  return messages.length;
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryPull(int) {
  try {
    await int.editReply("Pulling Emails.");

    const pulled = await logNPull();
    int.editReply(`Pulled ${pulled} Emails`);
  } catch (error) {
    u.errorHandler(error, "slashMissionaryPull");
    return await int.editReply("Error pulling emails.");
  }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRegister(int) {
  const user = int.options.getUser("user", true);
  const email = int.options.getString("email", true);

  if (!email.endsWith("@missionary.org")) return int.editReply("missionary emails must be part of @missionary.org");
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

  return int.editReply(`I set ${user.toString()}'s email to \`${email}\`.`);
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
  if (!email) return int.editReply(`${user} doesn't have an email set!`);
  return int.editReply(`${user} has their email stored as \`${email}\`.`);
}

Module
.setInit(logNPull)
.setClockwork(() => {
  return setInterval(logNPull, 24 * 60 * 60_000);
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
    if (!u.perms.calc(int.member, ["mod"])) return int.editReply("That command is only for mods.");

    switch (subcommand) {
      case "remove": return slashMissionaryRemove(int);
      case "check": return slashMissionaryCheck(int);
      case "register": return slashMissionaryRegister(int);
      case "pull": return slashMissionaryPull(int);
      default: return u.errorHandler(new Error("Slash Missionary - Unhandled Subcommand"), int);
    }
  }
})
.addEvent("interactionCreate", async (int) => {
  if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;

  if (int.customId.startsWith(approveIdPrefix)) {
    if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to approve missionary emails!", flags: ["Ephemeral"] });

    const embedPages = parseInt(int.customId.substring(approveIdPrefix.length));
    const pagedMessages = await int.channel?.messages.fetch({ before: int.message.id, limit: embedPages });
    if (!pagedMessages) return int.reply({ content: "I couldn't find the messages to forward!" });

    await int.update({ content: int.message.content + `\n(approved by ${int.user})`, components: [] });

    for (const message of pagedMessages.reverse().values()) {
      await int.client.getTextChannel(u.sf.channels.missionary.mail)?.send({ embeds: message.embeds, files: [...message.attachments.values()] });
    }
    await int.client.getTextChannel(u.sf.channels.missionary.mail)?.send({ embeds: int.message.embeds, files: [...int.message.attachments.values()] });

  }

  if (int.customId.startsWith(rejectIdPrefix)) {
    if (!u.perms.calc(int.member, ["mod"])) return int.reply({ content: "You don't have permissions to reject missionary emails!", flags: ["Ephemeral"] });

    int.update({ content: int.message.content + `\n(rejected by ${int.user})`, components: [] });
  }
});

module.exports = Module;