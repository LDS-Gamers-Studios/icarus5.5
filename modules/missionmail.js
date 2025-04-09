// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const send = require("nodemailer");
const receive = require("imapflow");
const interpret = require("mailparser-mit");
const Augur = require("augurbot-ts");
const XOAuth2 = require("nodemailer/lib/xoauth2");
const { ButtonStyle, Message } = require("discord.js");
const { AugurInteraction } = require("augurbot-ts/dist/structures/AugurInteraction");

/** @type {send.Transporter | undefined} */
let sender;
/** @type {receive.ImapFlow | undefined} */
let receiver;
/** @type {Map<string,string>} */
const askedApprovalUUIDFromEmailId = new Map();
/** @type {Map<string,Message<true>>} */
const pendingApprovals = new Map();
async function init() {
  if (!c.google.missionMail.enabled) {
    return;
  }
  const creds = c.google.missionMail;
  try {
    if (!sender) {
      sender = send.createTransport({
        service: 'gmail',
        auth: {
          type: "OAUTH2",
          user: creds.email,
          clientId: creds.oAuthServerCreds.web.client_id,
          clientSecret: creds.oAuthServerCreds.web.client_secret,
          refreshToken: creds.gAccountRefreshToken,
        },
      });
      sender.on("token", (token) => updateReceiver(token, creds.email));
      await sender.verify();
      // console.log(`Mailer sender initialized for ${creds.email}`);
    }
    if (!receiver) {
      // Create receiver only if sender is successfully initialized
      if (!sender) {
        u.errorHandler(new Error("Sender was not able to be initialized, receiver will not be created."));
      }
    }
  } catch (e) {
    u.errorHandler(e, "missionmail init");
    sender = undefined;
    receiver = undefined;
  }
}

/**
 * @param {XOAuth2.Token} accessToken
 * @param {string} email
 */
async function updateReceiver(accessToken, email) {
  try {
    receiver = new receive.ImapFlow({
      auth: {
        user: email,
        accessToken: accessToken.accessToken,
      },
      host: 'imap.gmail.com',
      port: 993,
    });
    await receiver.connect();
    await receiver.mailboxOpen("INBOX");
    sendUnsent();
    receiver.on("exists", sendUnsent); // this shouldn't run too often, but it could theoretically depending on how much the mail server spams.
    // console.log(`Mailer receiver initialized for ${email}`);
  } catch (error) {
    u.errorHandler(error, `updateReceiver for ${email}`);
    receiver = undefined;
  }
}
/**
 * @param {{ parsed: interpret.ParsedEmail; raw: receive.FetchMessageObject; }} email
 */
async function forwardEmail(email) {
  const ldsg = await module.exports.client.guilds.fetch(u.sf.ldsg);
  const fromEmailAndNames = email.parsed.from?.map(from => from.address ?? (from.name.length > 0 ? from.name : from.group))?.join();
  const mishId = await u.db.sheets.missionaries.findKey(address => fromEmailAndNames?.includes(address) ? address : false) + "";
  const fromEmail = u.db.sheets.missionaries.get(mishId) + "";
  const missionary = await ldsg.members.fetch(mishId);
  const requestUUID = await askMods({
    embeds: [u.embed({
      title: `incoming mishmail from ${missionary.user.username}(${fromEmailAndNames}) - ${email.parsed.subject}`,
      description: email.parsed.text?.replace(fromEmail, `${missionary.user.username}(${fromEmail})`),
      timestamp: email.parsed.receivedDate
    })] },
  async () => {
    receiver?.messageFlagsAdd([email.raw.uid], ["\\Seen"]);
    ldsg.client.getTextChannel(u.sf.channels.missionMail)?.send({ embeds: [u.embed({
      title: `${missionary.user.username} - ${email.parsed.subject}`,
      description: email.parsed.text?.replace(fromEmail, missionary.user.username),
      timestamp: email.parsed.receivedDate
    })] });
  },
  () => {
    receiver?.messageFlagsAdd([email.raw.uid], ["\\Seen"]);

  });
  askedApprovalUUIDFromEmailId.set(email.raw.uid + "", requestUUID);
  return requestUUID;
}
/**
 * @param {string | import("discord.js").MessageCreateOptions} msg
 * @param {function} approve
 * @param {function} reject
 */
async function askMods(msg, approve, reject) {
  const requestUUID = crypto.randomUUID();
  const [approveId, rejectId] = ["approvemishmail" + requestUUID, "rejectmishmail" + requestUUID];
  let componentMsg;
  // console.log(email);
  const missionMailApprovals = module.exports.client.getTextChannel(u.sf.channels.missionMailApprovals);
  const approveBtn = new u.Button().setCustomId(approveId).setLabel("Approve").setStyle(ButtonStyle.Primary);
  const rejectBtn = new u.Button().setCustomId(rejectId).setLabel("Reject").setStyle(ButtonStyle.Danger);
  const actionRow = u.MessageActionRow().addComponents([approveBtn, rejectBtn]);
  if (typeof msg === "string") {
    componentMsg = { content: msg };
  } else { componentMsg = msg; }
  // if (!componentMsg.components) {componentMsg.components = [];}
  componentMsg.components = (componentMsg.components ?? []).concat(actionRow);
  const sentMsg = await missionMailApprovals?.send(componentMsg);
  if (!sentMsg) {throw new Error("Couldn't be sure successful ask for mod approval in missionmail.");}
  pendingApprovals.set(requestUUID, sentMsg);
  module.exports.client.moduleManager.interactions.set(approveId, new AugurInteraction({
    type: "Button",
    id: approveId,
    process: (int) => {
      /** @type {Message} */
      // @ts-ignore
      const message = int.message;
      message.edit({
        content: message.content + `\n(approved by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId === approveId) &&
          !row.components.some(component => component.customId === rejectId)
        )
      });
      approve();
    }
  }, module.exports.client));
  module.exports.client.moduleManager.interactions.set(rejectId, new AugurInteraction({
    type: "Button",
    id: rejectId,
    process: (int) => {
      /** @type {Message} */
      // @ts-ignore
      const message = int.message;
      message.edit({
        content: message.content + `\n(rejected by ${int.user})`,
        components: message.components.filter(row =>
          !row.components.some(component => component.customId === approveId) &&
          !row.components.some(component => component.customId === rejectId)
        )
      });
      reject();
    }
  }, module.exports.client));
  return requestUUID;
  // ],
  //     client: module.exports.client,
  //    filepath: module.exports.filepath

}
async function sendUnsent() {
  if (receiver?.usable) {
    try {
      const messageIds = (await receiver.search({ seen: false })).filter(msgId => {// , from: "*@missionary.org" })).filter(msgId => {
        return askedApprovalUUIDFromEmailId.has(msgId + "") ? undefined : msgId;
      }
      );
      /** @type {{parsed:interpret.ParsedEmail, raw:receive.FetchMessageObject}[]} */
      const messages = await Promise.all((await receiver.fetchAll(messageIds, { source: true })).map(async raw => {return { parsed: await parse(raw), raw };}));
      // console.log(messages);
      // console.log("Checking for new emails:", messages?.length);
      messages.forEach(forwardEmail);
    } catch (error) {
      u.errorHandler(error, "sendUnsent");
    }
  } else {
    u.errorHandler(new Error("MishMail Receiver not usable, cannot check for new emails."));
  }
}
/**
 * @param {receive.FetchMessageObject} email
 * @returns {Promise<interpret.ParsedEmail>}
 */
async function parse(email) {
  // const parser = new interpret.MailParser();
  // parser.write(email.source)
  // parser.end()
  // return await parser.
  return await new Promise((resolve) => {
    const parser = new interpret.MailParser();
    parser.on("end", parsed => resolve(parsed));
    parser.write(email.source);
    parser.end();
  });
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailReInit(int) {
  sender?.close();
  sender?.removeAllListeners();
  sender = undefined;
  receiver?.close();
  receiver?.removeAllListeners();
  receiver = undefined;
  await init();
  await int.editReply("Mailer reinitialized.");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailRegister(int) {
  // todo forward to a mod channel to request register, then register if approved.
  const user = int.options.getUser("user", false) ?? int.member;
  const email = int.options.getString("email", true);
  // if (!email.endsWith("@missionary.org")) {return int.editReply("missionary emails must be part of @missionary.org");}
  // if (!u.perms.calc(int.member,["mod"]) && user.id != int.member.id) {
  //   return int.editReply("")
  u.db.sheets.data.docs?.config.sheetsByTitle.Mail.addRow({ "UserId": user.id, "Email": email });
  u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply(`Register command executed for ${user.displayName} setting email ${email}`);
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailRemove(int) {
  // todo remove.
  const user = int.options.getUser("user", false) ?? int.member;
  u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.delete();
  u.db.sheets.loadData(int.client, true, false, "missionaries");
  await int.editReply("Mission Mailer removed.");
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailCheck(int) {
  // todo remove.
  const user = int.options.getUser("user", false) ?? int.member;
  return int.editReply(user + " has the following mish email:" + u.db.sheets.data.missionaries.find((row) => row.get("UserId") === user.id)?.get("Email"));
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailPull(int) {
  // todo this should just manual trigger a function that clockwork runs every 15 minutes or so.
  // await receiver?.connect()
  if (receiver?.usable) {
    try {
      // Example: Check for new emails
      const messageIds = (await receiver.search({ seen: false })).filter(msgId => {// , from: "*@missionary.org" })).filter(msgId => {
        return askedApprovalUUIDFromEmailId.has(msgId + "") ? undefined : msgId;
      });
      await sendUnsent();
      await int.editReply(`Found ${messageIds.length} new emails.`);
      // Implement further logic to process these emails
    } catch (error) {
      u.errorHandler(error, "slashMishMailPull");
      await int.editReply("Error pulling emails.");
    }
  } else {
    await int.editReply("Mailer receiver is not ready.");
  }
}
/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashMishMailSend(int) {
  const ldsg = await int.client.guilds.fetch(u.sf.ldsg);
  const pingMatch = /<@!?([0-9]+)>/.exec(int.options.getString("missionary", true));
  if (!pingMatch || !pingMatch[1]) { return int.editReply("You need to @ mention a registered missionaries discord account."); }
  const missionaryDiscord = await ldsg.members.fetch(pingMatch[1]);
  const content = int.options.getString("content", true);
  const email = u.db.sheets.missionaries.get(missionaryDiscord.id);
  if (!email) {
    return int.editReply(missionaryDiscord.user.toString() + " isn't a registered missionary. have them get in contact with a mod to link their missionary email.");
  }

  // todo forward to a mod channel to request send, then send if approved.
  if (sender) {
    try {
      askMods({ embeds: [u.embed({
        title: `outgoing mishmail from ${int.member.user.username} to ${missionaryDiscord.user.username}(${email})`,
        description: content
      })] }, () => {
        sender?.sendMail({
          to: email,
          // to: "recipient@example.com", // Replace with actual recipient
          subject: "LDSG Mishmail from " + int.member.user.username,
          text: content,
        });
        int.member.send(`Your Requested Mishmail to ${missionaryDiscord.user.toString()} was approved and sent!\nContent:${content}`);
      }, () => {
        int.member.send(`Your Requested Mishmail to ${missionaryDiscord.user.toString()} was rejected.\nContent:${content}`);
      });
      await int.editReply("Asking mods if its good to send.");
    } catch (error) {
      u.errorHandler(error, "slashMishMailSend");
      await int.editReply("Error sending email.");
    }
  } else {
    await int.editReply("Mailer sender is not initialized.");
  }
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
        u.errorHandler(new Error("MishMail Receiver not usable for periodic check."));
      }
    }, 60 * 60 * 1000); // Every hour
  })
  .addInteraction({
    name: "mishmail",
    id: u.sf.commands.slashMishmail,
    onlyGuild: true,
    hidden: true,
    permissions: (int) => u.perms.calc(int.member, ["trusted"]),
    process: async (int) => {
      const subcommand = int.options.getSubcommand(true);
      await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
      if (subcommand !== "send" && !u.perms.calc(int.member, ["mod"])) return int.editReply("That command is only for mods.");
      switch (subcommand) {
        case "send":
          return slashMishMailSend(int);
        case "remove":
          return slashMishMailRemove(int);
        case "check":
          return slashMishMailCheck(int);
        case "register":
          return slashMishMailRegister(int);
        case "pull":
          return slashMishMailPull(int);
        case "reinit":
          return slashMishMailReInit(int);
        default:
          return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    },
    autocomplete: async (int) => {
      const ldsg = await int.client.guilds.fetch(u.sf.ldsg);
      // console.log(u.db.sheets.missionaries);
      const ret = await Promise.all(u.db.sheets.missionaries.map((_email, uid) => ldsg.members.fetch(uid).then(m => { return { name: m.user.username, value: m.user.toString() + "" };})));
      // console.log(ret);
      await int.respond(ret);
      return ret;
    }
  })
  .addCommand({
    name: "mishmailunread",
    permissions: () => c.devMode, // perms.calc(msg.member, ["mod"]),
    process: async function(message) {
      return message.reply(
        (await receiver?.messageFlagsRemove([4], ["\\Seen"])) ? "Success" : "Fail"
      );
    }
  });
  // .addEvent("interactionCreate", (int) => {
  //   if (!int.inCachedGuild() || !int.isButton() || int.guild.id !== u.sf.ldsg) return;
  //   if (int.customId.startsWith("approvemishmail")) {
  //     sendMailPendingApprovals.get(int.customId.substring("approvemishmail".length))?.approve();
  //   }
  //   if (int.customId.startsWith("rejectmishmail")) {
  //     sendMailPendingApprovals.get(int.customId.substring("rejectmishmail".length))?.reject();
  //   }
  // });

module.exports = Module;