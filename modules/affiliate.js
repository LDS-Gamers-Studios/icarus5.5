const Augur = require("augurbot-ts"),
  hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/,
  affiliateLinks = {
    //  amazon: { //REMOVE INDENT BEFORE "amazon:" BEFORE REACTIVATING
    //  site: "Amazon",
    //  affiliate: "Amazon Affiliate",
    //  test: /amazon\.(com|co\.uk)\/(\w+(-\w+)*\/)?(gp\/product|dp)\/(\w+)/i,
    //  tag: /tag=ldsgamers-20/,
    //  link: (match) => `https://www.${match[0]}?tag=ldsgamers-20`
    //  }, //REMOVE INDENT BEFORE "}," BEFORE REACTIVATING
    cdkeys: {
      site: "CDKeys.com",
      affiliate: "CDKeys Affiliate",
      test: /cdkeys\.com(\/\w+(-\w+)*)*/i,
      tag: /mw_aref=LDSGamers/i,
      link: match => `https://www.${match[0]}?mw_aref=LDSGamers`
    },
    //  humblebundle: { //REMOVE INDENT BEFORE "humblebundle:" BEFORE REACTIVATING
    // site: "Humble Bundle",
    //  affiliate: "Humble Bundle Partner",
    //  test: /humblebundle\.com(\/\w+(-\w+)*)*/i,
    //  tag: /partner=ldsgamers/i,
    //  link: (match) => `https://www.${match[0]}?partner=ldsgamers`
    //  }, //REMOVE INDENT BEFORE "}," BEFORE REACTIVATINg
  };

function processLinks(msg) {
  for (const x in affiliateLinks) {
    const site = affiliateLinks[x];
    const match = site.test.exec(msg.cleanContent);
    if (match && !site.tag.test(msg.cleanContent)) {
      msg.channel.send(`You can help LDSG by using our ${site.affiliate} [Link](${site.link(match)})`);
    }
  }
}

const Module = new Augur.Module()
// No idea if any of this works. I didn't test it. Bobby told me not to remove it to just comment it out. -SPAM
//  .addCommand({ name: "humble",
//  description: "Get the LDSG Partner link to the current Humble Bundle.",
//  aliases: ["hb"],
//  category: "LDSG",
//  process: (msg) => msg.channel.send("LDSG's Partner link to the current Humble Bundle:\nhttp://ldsg.io/humble")
//  })
.addEvent("message", (msg) => {
  if (hasLink.test(msg.cleanContent)) {processLinks(msg);}
})
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (hasLink.test(msg.cleanContent) && (oldMsg.partial || hasLink.test(oldMsg.cleanContent))) {
    processLinks(msg);
  }
});

module.exports = Module;