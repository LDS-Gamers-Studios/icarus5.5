// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const send = require("nodemailer");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const htmlparse = require("html-to-text");
const Augur = require("augurbot-ts");
const pf = new (require('profanity-matcher'));
const banned = require('../data/banned.json');
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
/** @type {send.Transporter | undefined} */
let sender;
/** @type {receive.ImapFlow | undefined} */
let receiver;
/** @type {Map<string, {approve:() => any, reject:() => any}>} */
const awaitingMods = new Map();
async function init() {
  const creds = c.google.mail;
  if (!creds.enabled || sender) return;

  try {

    sender = send.createTransport({
      service: 'gmail',
      auth: {
        type: "LOGIN",
        user: creds.email,
        pass: creds.gAccountAppPass,
        // clientId: creds.oAuthServerCreds.web.client_id,
        // clientSecret: creds.oAuthServerCreds.web.client_secret,
        // refreshToken: creds.gAccountRefreshToken,
      },
    });

    receiver = new receive.ImapFlow({
      auth: {
        user: creds.email,
        pass: creds.gAccountAppPass
        // accessToken: token.accessToken,
      },
      host: 'imap.gmail.com',
      port: 993,
    });

    await receiver.connect();
    await receiver.mailboxOpen("INBOX");

    sendUnsent();
    receiver.on("exists", sendUnsent);

    setInterval(async () => {
      // sender.on("token", async (token) => {
      try {
        receiver?.removeAllListeners();
        receiver?.close();
        receiver = new receive.ImapFlow({
          auth: {
            user: creds.email,
            pass: creds.gAccountAppPass
            // accessToken: token.accessToken,
          },
          host: 'imap.gmail.com',
          port: 993,
        });
        await receiver.connect();
        await receiver.mailboxOpen("INBOX");
        sendUnsent();
        receiver.on("exists", sendUnsent); // this shouldn't run too often, but it could theoretically depending on how much the email server spams.
        // console.log(`Mailer receiver initialized for ${email}`);
      } catch (error) {
        u.errorHandler(error, `updateReceiver for ${creds.email}`);
        receiver = undefined;
      }
    }, 60 * 60_000);

    await sender.verify();
    // console.log(`Mailer sender initialized for ${creds.email}`);
  } catch (e) {
    u.errorHandler(e, "missionmail init");
    sender = undefined;
    receiver = undefined;
  }
}
async function sendUnsent() {
  if (receiver?.usable) {
    try {
      let messageIds = (await receiver.search({ unKeyword: 'icarusForwarded' }));// , from: "*@missionary.org" }))
      messageIds = messageIds.filter(msgId => {
        return awaitingMods.has(msgId + "") ? undefined : msgId;
      });

      const messages = await receiver.fetchAll(messageIds, { source: true });
      // console.log(messages);
      // console.log("Checking for new emails:", messages?.length);
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
        if (!parsed.text) {throw new Error("unable to parse email with no discrnable text, html, or subject");}
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
        // search for profanity
        const pfViolations = pf.scan(parsed.text + "");
        const bannedViolations = [banned.links, banned.words, banned.scam].flat().filter(bannedString => parsed.text.includes(bannedString) ? bannedString : undefined);
        // figure out who it is from
        const fromEmail = parsed.from ? parsed.from[0].address : "Err:NoFromAddress";
        const missionaryId = await u.db.sheets.missionaries.findKey(address => fromEmail?.includes(address) ? address : false);
        // get some discord side of things stuff
        const ldsg = await module.exports.client.guilds.fetch(u.sf.ldsg);
        const missionary = missionaryId ? await ldsg.members.fetch(missionaryId) : undefined;
        const missionMailApprovals = await ldsg.channels.fetch(u.sf.channels.missionMailApprovals);
        if (!missionMailApprovals || missionMailApprovals.type !== ChannelType.GuildText) { throw new Error("unable to find approval channel for missionary emails."); }
        // setup the functions to mark it as handled and forward it when approved, or just mark when rejected
        // setup the request message, including listing detected profanity at the top,
        // and the embed almost the same, but not fully replaced, just marked as will be replaced.
        // and approve and reject buttons
        const approveBtn = new u.Button().setCustomId(approveIdPrefix + "from" + rawMsg.uid).setLabel("Approve").setStyle(ButtonStyle.Primary);
        const rejectBtn = new u.Button().setCustomId(rejectIdPrefix + "from" + rawMsg.uid).setLabel("Reject").setStyle(ButtonStyle.Danger);
        const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);
        const requestMsg = {
          components: [actionRow],
          content:
            (bannedViolations.length > 0 ? '# DETECTED BANNED PHRASES:\n' + bannedViolations.join(', ') : '')
            + (bannedViolations.length > 0 && pfViolations.length > 0 ? '\n' : '') +
            (pfViolations.length > 0 ? '# DETECTED PROFANITY:\n' + pfViolations.join(', ') : ''),
          embeds: [u.embed({
            title: `incoming missionary email from ${missionary?.user.username ?? "NON REGISTERED MISSIONARY EMAIL"}(${fromEmail}) - ${parsed.subject}`,
            description: parsed.text.replace(fromEmail, `${missionary?.user.username ?? "NON REGISTERED MISSIONARY EMAIL"}(${fromEmail})`),
            timestamp: parsed.receivedDate
          })]
        };
        // store what to do when the question is answered
        awaitingMods.set("from" + rawMsg.uid, {
          approve: async () => {
            receiver?.messageFlagsAdd([rawMsg.uid], ["icarusForwarded"]);
            ldsg.client.getTextChannel(u.sf.channels.missionMail)?.send({
              embeds: [u.embed({
                title: `${missionary?.user.username ?? "NON REGISTERED MISSIONARY EMAIL"} - ${parsed.subject}`,
                description: parsed.text.replace(fromEmail, missionary?.user.username ?? "NON REGISTERED MISSIONARY EMAIL"),
                timestamp: parsed.receivedDate
              })]
            });
          },
          reject: () => receiver?.messageFlagsAdd([rawMsg.uid], ["icarusForwarded"])
        });
        // pop the question
        await missionMailApprovals.send(requestMsg);
      }
    } catch (error) {
      u.errorHandler(error, "sendUnsent");
    }
  } else {
    u.errorHandler(new Error("Missionary Email Receiver not usable, cannot check for new emails."));
  }
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryReInit(int) {
  if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
  sender?.close();
  sender?.removeAllListeners();
  sender = undefined;
  receiver?.close();
  receiver?.removeAllListeners();
  receiver = undefined;
  await init();
  await int.editReply("Emailer reinitialized.");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionarySend(int) {
  const ldsg = await int.client.guilds.fetch(u.sf.ldsg);
  const pingMatch = /<@!?([0-9]+)>/.exec(int.options.getString("missionary", true));
  if (!pingMatch || !pingMatch[1]) { return int.editReply("You need to @ mention a registered missionaries discord account."); }
  const missionaryDiscord = await ldsg.members.fetch(pingMatch[1]);
  const content = int.options.getString("content", true);
  const pfViolations = pf.scan(content);
  const bannedViolations = [banned.links, banned.words, banned.scam].flat().filter(bannedString => content.includes(bannedString) ? bannedString : undefined);
  const email = u.db.sheets.missionaries.get(missionaryDiscord.id);
  if (!email) {
    return int.editReply(missionaryDiscord.user.toString() + " isn't a registered missionary. have them get in contact with a mod to link their missionary email.");
  }

  if (sender) {
    try {
      const missionMailApprovals = await ldsg.channels.fetch(u.sf.channels.missionMailApprovals);
      if (!missionMailApprovals || missionMailApprovals.type !== ChannelType.GuildText) { throw new Error("unable to find approval channel for missionary emails"); }
      const approveBtn = new u.Button().setCustomId(approveIdPrefix + "to" + int.id).setLabel("Approve").setStyle(ButtonStyle.Primary);
      const rejectBtn = new u.Button().setCustomId(rejectIdPrefix + "to" + int.id).setLabel("Reject").setStyle(ButtonStyle.Danger);
      const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);
      const message = {
        components: [actionRow],
        content:
          (bannedViolations.length > 0 ? '# DETECTED BANNED PHRASES:\n' + bannedViolations.join(', ') : '')
          + (bannedViolations.length > 0 && pfViolations.length > 0 ? '\n' : '') +
          (pfViolations.length > 0 ? '# DETECTED PROFANITY:\n' + pfViolations.join(', ') : ''),
        embeds: [u.embed({
          title: `outgoing missionary email from ${int.member.user.username} to ${missionaryDiscord.user.username}(${email})`,
          description: content
        })]
      };
      awaitingMods.set("to" + int.id, {
        approve: () => {
          sender?.sendMail({
            to: email,
            // to: "recipient@example.com", // Replace with actual recipient
            subject: "LDSG Missionary email from " + int.member.user.username,
            text: content,
          });
          int.member.send(`Your Requested Missionary email to ${missionaryDiscord.user.toString()} was approved and sent!\nContent:${content}`);
        },
        reject: () => {
          int.member.send(`Your Requested Missionary email to ${missionaryDiscord.user.toString()} was rejected.\nContent:${content}`);
        }
      });
      missionMailApprovals.send(message);
      await int.editReply("Asking mods if its good to send.");
    } catch (error) {
      u.errorHandler(error, "slashMissionarySend");
      await int.editReply("Error sending email.");
    }
  } else {
    await int.editReply("Email sender is not initialized.");
  }
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryPull(int) {
  if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
  if (receiver?.usable) {
    try {
      await sendUnsent();
      await int.editReply(`Processing new missionary emails.`);
      // Implement further logic to process these emails
    } catch (error) {
      u.errorHandler(error, "slashMissionaryPull");
      await int.editReply("Error pulling emails.");
    }
  } else {
    await int.editReply("Missionary Email receiver is not ready.");
  }
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRegister(int) {
  if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
  const user = int.options.getUser("user", false) ?? int.member;
  const email = int.options.getString("email", true);
  // if (!email.endsWith("@missionary.org")) {return int.editReply("missionary emails must be part of @missionary.org");}
  u.db.sheets.data.docs?.config.sheetsByTitle.Mail.addRow({ "UserId": user.id, "Email": email });
  u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply(`Register command executed for ${user.displayName} setting email ${email}`);
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryRemove(int) {
  if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
  const user = int.options.getUser("user", false) ?? int.member;
  u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.delete();
  u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply("Mission Email De-Registered.");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMissionaryCheck(int) {
  if (!u.perms.calc(int.member, ["mod"])) return int.editReply("This command may only be used by Mods.");
  const user = int.options.getUser("user", false) ?? int.member;
  return int.editReply(user + " has the following missionary email:" + u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.get("Email"));
}
const Module = new Augur.Module()
  .setInit(init)
  .setClockwork(() => {
    return setInterval(async () => {
      if (receiver?.usable) {
        try {
          // Implement your periodic email checking logic here
          sendUnsent();
        } catch (error) {
          u.errorHandler(error, "Clockwork email check");
        }
      } else {
        u.errorHandler(new Error("missionary email Receiver not usable for periodic check."));
      }
    }, 60 * 60 * 1000); // Every hour
  })
  .addInteraction({
    name: "missionary",
    id: u.sf.commands.slashMissionary,
    onlyGuild: true,
    hidden: true,
    permissions: (int) => u.perms.calc(int.member, ["trusted"]),
    process: async (int) => {
      const subcommand = int.options.getSubcommand(true);
      await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
      if (subcommand !== "send" && !u.perms.calc(int.member, ["mod"])) return int.editReply("That command is only for mods.");
      switch (subcommand) {
        case "send": return slashMissionarySend(int);
        case "remove": return slashMissionaryRemove(int);
        case "check": return slashMissionaryCheck(int);
        case "register": return slashMissionaryRegister(int);
        case "pull": return slashMissionaryPull(int);
        case "reinit": return slashMissionaryReInit(int);
        default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    },
    autocomplete: async (int) => {
      const ldsg = await int.client.guilds.fetch(u.sf.ldsg);
      // console.log(u.db.sheets.missionaries);
      const ret = await Promise.all(u.db.sheets.missionaries.map((_email, uid) => ldsg.members.fetch(uid).then(m => { return { name: m.user.username, value: m.user.toString() + "" }; })));
      // console.log(ret);
      await int.respond(ret);
      return ret;
    }
  })
  .addCommand({
    name: "missionaryunread",
    permissions: () => c.devMode, // perms.calc(msg.member, ["mod"]),
    process: async function(message) {
      return message.reply(
        (await receiver?.messageFlagsRemove([4], ["icarusForwarded"])) ? "Success" : "Fail"
      );
    }
  })
  .addEvent("interactionCreate", (int) => {
    if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;
    if (int.customId.startsWith(approveIdPrefix)) {
      if (!u.perms.calc(int.member, ["mod"])) {
        return int.reply({ content: "You don't have permissions to approve missionary emails!", ephemeral: true });
      }
      const id = int.customId.substring(approveIdPrefix.length);
      awaitingMods.get(id)?.approve();
      /** @type {Message} */
      const message = int.message;
      message.edit({
        content: message.content + `\n(approved by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId?.endsWith(id)) &&
          !row.components.some(component => component.customId?.endsWith(id))
        )
      });
      awaitingMods.delete(int.customId.substring(approveIdPrefix.length));
    }
    if (int.customId.startsWith(rejectIdPrefix)) {
      if (!u.perms.calc(int.member, ["mod"])) {
        return int.reply({ content: "You don't have permissions to reject missionary emails!", ephemeral: true });
      }
      const id = int.customId.substring(rejectIdPrefix.length);
      awaitingMods.get(id)?.reject();
      /** @type {Message} */
      const message = int.message;
      message.edit({
        content: message.content + `\n(rejected by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId?.endsWith(id)) &&
          !row.components.some(component => component.customId?.endsWith(id))
        )
      });
      awaitingMods.delete(int.customId.substring(approveIdPrefix.length));
    }
  });

module.exports = Module;