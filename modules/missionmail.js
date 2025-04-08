// @ts-check
const u = require("../utils/utils");
const c = require("../config/config.json");
const send = require("nodemailer");
const receive = require("imapflow");
const interpret = require("mailparser-mit")
const Augur = require("augurbot-ts");
const XOAuth2 = require("nodemailer/lib/xoauth2");

/** @type {send.Transporter | undefined} */
let sender;
/** @type {receive.ImapFlow | undefined} */
let receiver;
/**
 * @type {import("discord.js").TextChannel | null}
 */
let missionPrep;
/**
 * @type {import("discord.js").TextChannel | null}
 */
let missionMail;
/**
 * @type {import("discord.js").TextChannel | null}
 */
let missionMailApprovals;
/**
 * @type {Map<string,{mailUid:string, mail:{parsed:interpret.ParsedEmail,raw:receive.FetchMessageObject}, int:import("discord.js").Interaction}>}
 */
const sendMails = new Map();
function loadChannels() {
  missionPrep = Module.client.getTextChannel(u.sf.channels.missionPrep);
  missionMail = Module.client.getTextChannel(u.sf.channels.missionMail);
  missionMailApprovals = Module.client.getTextChannel(u.sf.channels.missionMailApprovals);
}
async function init() {
  loadChannels();  
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
      await sender.verify()
      console.log(`Mailer sender initialized for ${creds.email}`);
    }
    if (!receiver) {
      // Create receiver only if sender is successfully initialized
      if (!sender) {
        console.warn("Sender not initialized, receiver will not be created.");
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
    await receiver.connect()
    await receiver.mailboxOpen("INBOX")
    console.log(`Mailer receiver initialized for ${email}`);
  } catch (error) {
    u.errorHandler(error, `updateReceiver for ${email}`);
    receiver = undefined;
  }
}
/**
 * @param {interpret.ParsedEmail} email
 * @param {function} approve
 * @param {function} reject
 */
async function forwardEmail(email,approve,reject) {
  if (!missionMailApprovals || !missionMail || !missionPrep) { loadChannels(); }
  console.log(email)
  // missionMailApprovals
  missionMailApprovals?.send({embeds:[u.embed({
    title: email.from?.map(from => from.name.length > 0 ? from.name:from.group ?? from.address)?.join() + " - " + email.subject,
    description: email.text,
    timestamp: email.receivedDate
  })]})
}
async function sendUnsent() {
  if (receiver?.usable) {
    try {
      const messageIds = (await receiver.search({ seen: false, from:"*@missionary.org" })).filter(msgId => {
        return sendMails.has(msgId+"") ? undefined: msgId;
      }
      )
      /** @type {{parsed:interpret.ParsedEmail, raw:receive.FetchMessageObject}[]} */
      const messages = await Promise.all((await receiver.fetchAll(messageIds, {source: true})).map(async raw => {return {parsed:await parse(raw),raw}}));
      console.log(messages)
      console.log("Checking for new emails:", messages?.length);
      messages.forEach(pair => forwardEmail(
        pair.parsed,
        () => {
          receiver?.messageFlagsAdd([pair.raw.uid],["\\Seen"])
          missionMail?.send({embeds:[u.embed({
            title: pair.parsed.from?.map(from => from.name.length > 0 ? from.name:from.group ?? from.address)?.join() + " - " + pair.parsed.subject,
            description: pair.parsed.text,
            timestamp: pair.parsed.receivedDate
          })]})
        },
        () => receiver?.messageFlagsAdd([pair.raw.uid],["\\Seen"])
      ));
    } catch (error) {
      u.errorHandler(error, "sendUnsent");
    }
  } else {
    console.warn("Receiver not usable, cannot check for new emails.");
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
    parser.on("end",email => resolve(email))
    parser.write(email.source)
    parser.end()
  });
}

async function slashMishMailReInit(int) {
  sender?.close();
  sender?.removeAllListeners();
  sender = undefined;
  receiver?.close();
  receiver?.removeAllListeners();
  receiver = undefined;
  await init();
  await int.editReply({ content: "Mailer reinitialized.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
}

async function slashMishMailRegister(int) {
  // todo forward to a mod channel to request register, then register if approved.
  await int.editReply({ content: "Register command executed (placeholder)", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
}

async function slashMishMailRemove(int) {
  // todo remove.
  sender?.close();
  sender?.removeAllListeners();
  sender = undefined;
  receiver?.close();
  receiver?.removeAllListeners();
  receiver = undefined;
  await int.editReply({ content: "Mailer removed.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
}

async function slashMishMailPull(int) {
  // todo this should just manual trigger a function that clockwork runs every 15 minutes or so.
  // await receiver?.connect()
  if (receiver?.usable) {
    try {
      // Example: Check for new emails
      const messages = await receiver.search({ seen: false });
      await sendUnsent()
      await int.editReply({ content: `Found ${messages.length} new emails. (Placeholder)`, flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
      // Implement further logic to process these emails
    } catch (error) {
      u.errorHandler(error, "slashMishMailPull");
      await int.editReply({ content: "Error pulling emails.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
    }
  } else {
    await int.editReply({ content: "Mailer receiver is not ready.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
  }
}

async function slashMishMailSend(int) {
  // todo forward to a mod channel to request send, then send if approved.
  if (sender) {
    try {
      // Example: Sending a test email
      await sender.sendMail({
        to: c.google.missionMail.email,
        // to: "recipient@example.com", // Replace with actual recipient
        subject: "Test Email from Discord Bot",
        text: "This is a test email sent from the bot!",
      });
      await int.editReply({ content: "Test email sent (placeholder).", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
    } catch (error) {
      u.errorHandler(error, "slashMishMailSend");
      await int.editReply({ content: "Error sending email.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
    }
  } else {
    await int.editReply({ content: "Mailer sender is not initialized.", flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });
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
        console.warn("Mailer receiver not usable for periodic check.");
      }
    }, 15 * 60 * 1000); // Every 15 minutes
  })
  .addInteraction({
    name: "mishmail",
    id: u.sf.commands.slashMishmail,
    onlyGuild: true,
    hidden: true,
    permissions: (int) => u.perms.calc(int.member, ["trusted"]),
    process: async (int) => {
      const subcommand = int.options.getSubcommand(true);
      const forThePing = await int.deferReply({ flags: u.ephemeralChannel(int, u.sf.channels.missionPrep) });

      switch (subcommand) {
        case "send":
          return slashMishMailSend(int);
        case "pull":
          return slashMishMailPull(int);
        case "remove":
          return slashMishMailRemove(int);
        case "register":
          return slashMishMailRegister(int);
        case "reinit":
          return slashMishMailReInit(int);
        default:
          return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
    },
    // autocomplete: (int) => {
    //   // Implement autocomplete logic if needed
    // }
  });

module.exports = Module;