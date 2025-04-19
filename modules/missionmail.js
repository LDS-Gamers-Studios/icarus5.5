// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const htmlparse = require("html-to-text");
const Augur = require("augurbot-ts");
const { ChannelType, ButtonStyle, Message } = require("discord.js");
const [approveIdPrefix, rejectIdPrefix] = ["approvemissionmail", "rejectmissionmail"];
const replyRegexes = [
  // /^on[\s\n\r]+.+wrote:[\s\n\r]*$/im,
  // /on[\s\n\r]+.+wrote:[\s\n\r]*/im,
  /^on[^>]*@[^<]*wrote:\n\n>/im,
  // /^on\s.+wrote:\s*$/im,
  // /On\s.+wrote:\s*/im,
  /^>.*$/m,
  /^-+ original message -+$/m,
  /^from:.*$/m,
  /^sent:.*$/m,
  /^to:.*$/m,
  /^subject:.*$/m,
  /^date:.*$/m
];
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
    });
    await receiver.connect();
    await receiver.mailboxOpen("INBOX");
    const sent = await sendUnsent(receiver);
    receiver.removeAllListeners();
    receiver.close();
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
  if (!receiver.usable) {
    throw new Error("Missionary Email Receiver not usable, cannot check for new emails.");
  }
  const messageIds = await receiver.search({ unKeyword: 'icarusForwarded', or: u.db.sheets.missionaries.map((email) => {return { from: email };}) });
  const messages = await receiver.fetchAll(messageIds, { source: true });
  for (const rawMsg of messages) {
    // parse the email source into readable stuff
    const parsed = await new Promise((resolve) => {
      const parser = new interpret.MailParser();
      parser.on("end", result => resolve(result));
      parser.write(rawMsg.source);
      parser.end();
    });
    // make sure there is text
    if (!parsed.text || parsed.text.length < 1) {
      if (parsed.html) {
        parsed.text = htmlparse.convert(parsed.html);
      } else {
        parsed.text = parsed.subject;
      }
    }
    if (!parsed.text) throw new Error("unable to parse email with no discrnable text, html, or subject");
    // trim the reply quote from the bottom if there is one (for some reason it was bypassing email replace)
    for (const regex of replyRegexes) {
      const match = parsed.text.toLowerCase().search(regex);
      if (match && match > 0) {
        // parsed.fullText = parsed.text;
        parsed.text = parsed.text.substring(0, match);
        break; // Stop after the first match to avoid over-trimming
      }
    }
    parsed.text = parsed.text.trimEnd();
    // figure out who it is from
    const fromEmail = parsed.from ? parsed.from[0].address : "Err:NoFromAddress";
    const missionaryId = u.db.sheets.missionaries.findKey(address => fromEmail?.includes(address) ? address : false);
    // get some discord side of things stuff
    const ldsg = module.exports.client.guilds.cache.get(u.sf.ldsg);
    const missionary = ldsg && missionaryId ? ldsg.members.cache.get(missionaryId) : undefined;
    if (!missionary) {
      // still need this in case the filter fails or they aren't a member anymore.
      receiver.messageFlagsAdd([rawMsg.uid], ["icarusForwarded"]);
      continue;
    }
    const missionMailApprovals = ldsg.channels.cache.get(u.sf.channels.missionMailApprovals);
    if (!missionMailApprovals || missionMailApprovals.type !== ChannelType.GuildText) { throw new Error("unable to find approval channel for missionary emails."); }
    // buttons are handled at the bottom, only the embed gets forwarded. anything for mods but not normies should not go in the embed.
    const approveBtn = new u.Button().setCustomId(approveIdPrefix + "from" + rawMsg.uid).setLabel("Approve").setStyle(ButtonStyle.Primary);
    const rejectBtn = new u.Button().setCustomId(rejectIdPrefix + "from" + rawMsg.uid).setLabel("Reject").setStyle(ButtonStyle.Danger);
    const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);
    const embed = u.embed()
    .setAuthor({ name: missionary.displayName, iconURL: missionary.avatarURL() ?? undefined })
    .setTitle(`${missionary.displayName} - ${parsed.subject}`)
    .setDescription(parsed.text.replace(fromEmail, missionary.displayName))
    .setTimestamp(parsed.receivedDate);
    const requestMsg = {
      content: `incoming missionary email from ${missionary.toString()}(\`${fromEmail}\`)`,
      embeds: [embed],
      components: [actionRow]
    };
    // pop the question
    receiver.messageFlagsAdd([rawMsg.uid], ["icarusForwarded"]);
    await missionMailApprovals.send(requestMsg);
  }
  return messages.length;
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryPull(int) {
  try {
    await int.editReply("Pulling Emails.");
    logNPull().then(
      (n) => int.editReply("Pulled Emails:" + n),
      (e) => {
        u.errorHandler(e, "slashMissionaryPull");
        int.editReply("Error pulling emails.");
      }
    );
  } catch (error) {
    u.errorHandler(error, "slashMissionaryPull");
    return await int.editReply("Error pulling emails.");
  }
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRegister(int) {
  const user = int.options.getUser("user", false) ?? int.member;
  const email = int.options.getString("email", true);
  if (!email.endsWith("@missionary.org")) {return int.editReply("missionary emails must be part of @missionary.org");}
  if (u.db.sheets.missionaries.has(user.id)) {return int.editReply(`${user.toString()} already has email \`${email}\` registered. Remove that first to register a new one.`);}
  await u.db.sheets.data.docs?.config.sheetsByTitle.Mail.addRow({ "UserId": user.id, "Email": email });
  await u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply(`Register command executed for ${user.toString()} setting email \`${email}\``);
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRemove(int) {
  const user = int.options.getUser("user", false) ?? int.member;
  u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.delete();
  u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply("Mission Email De-Registered.");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryCheck(int) {
  const user = int.options.getUser("user", false) ?? int.member;
  return int.editReply(user.toString() + " has the following missionary email: `" + u.db.sheets.missionaries.findKey(id => id === user.id) + '`');
}
const Module = new Augur.Module()
  .setInit(logNPull)
  .setClockwork(() => {
    return setInterval(logNPull, 5 * 60 * 60_000);
  })
  .addInteraction({
    name: "missionary",
    id: u.sf.commands.slashMissionary,
    onlyGuild: true,
    hidden: true,
    permissions: (int) => u.perms.calc(int.member, ["mod"]),
    process: async (int) => {
      // just a double check.
      if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
      const subcommand = int.options.getSubcommand(true);
      await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionMailApprovals) });
      if (!u.perms.calc(int.member, ["mod"])) return int.editReply("That command is only for mods.");
      switch (subcommand) {
        case "remove": return slashMissionaryRemove(int);
        case "check": return slashMissionaryCheck(int);
        case "register": return slashMissionaryRegister(int);
        case "pull": return slashMissionaryPull(int);
        default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    }
  })
  .addEvent("interactionCreate", (int) => {
    if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;
    if (int.customId.startsWith(approveIdPrefix)) {
      if (!u.perms.calc(int.member, ["mod"])) {
        return int.reply({ content: "You don't have permissions to approve missionary emails!", ephemeral: true });
      }
      const id = int.customId.substring(approveIdPrefix.length);
      /** @type {Message} */
      const message = int.message;
      int.client.getTextChannel(u.sf.channels.missionMail)?.send({
        embeds: int.message.embeds
      });
      message.edit({
        content: message.content + `\n(approved by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId?.endsWith(id)) &&
          !row.components.some(component => component.customId?.endsWith(id))
        )
      });
    }
    if (int.customId.startsWith(rejectIdPrefix)) {
      if (!u.perms.calc(int.member, ["mod"])) {
        return int.reply({ content: "You don't have permissions to reject missionary emails!", ephemeral: true });
      }
      const id = int.customId.substring(rejectIdPrefix.length);
      /** @type {Message} */
      const message = int.message;
      message.edit({
        content: message.content + `\n(rejected by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId?.endsWith(id)) &&
          !row.components.some(component => component.customId?.endsWith(id))
        )
      });
    }
  });

module.exports = Module;