// @ts-check
const Augur = require("augurbot-ts"),
  Discord = require("discord.js"),
  Parser = require("rss-parser"),
  u = require("../utils/utils"),
  /** @type {Record<string, Record<string, string[][]>>} */
  jstRef = require("../data/gospel/jst-reference.json"),
  books = require("../data/gospel/books.json");

/**
 * @typedef Book
 * @prop {string} bookName
 * @prop {string} urlAbbrev
 * @prop {string} work
 * @prop {string[]} abbreviations
 *
 * @typedef Ref
 * @prop {string} book
 * @prop {string} chapter
 * @prop {string} verses
 */


/** @type {Discord.Collection<string, Omit<Book, "abbreviations">>} */
const abbreviationTable = new u.Collection();

const jstRegex = /\[JST ([0-9]{1,2})\]$/;
let searchExp = new RegExp("");

const works = {
  "ot": "old-testament",
  "nt": "new-testament",
  "bofm": "book-of-mormon",
  "dc-testament": "doctrine-and-covenants",
  "pgp": "pearl-of-great-price"
};


const manuals = new u.Collection([
  [2022, "old-testament-2022"],
  [2023, "new-testament-2023"],
  [2024, "book-of-mormon-2024"],
  [2025, "doctrine-and-covenants-2025"]
]);

/**
 * Builds the abbreviation lookup table for books of scripture.
 * @param {object} book The book to pass in
 * @param {String} book.bookName The canonical book name. Ex: "Song of Solomon"
 * @param {String[]} book.abbreviations An array of abbreviations, in lowercase. Ex: ["song", "sos"], ["dc", "d&c"]
 * @param {String} book.work The abbreviation for the work it's from, according to the Church URL. Ex: "ot", "bofm", "dc-testament"
 * @param {String} book.urlAbbrev The abbreviation for the chapter in the link. For 1 Nephi, this is 1-ne.
 * @return This method mutates the lookup array.
 */
function refAbbrBuild(book) {
  const { bookName, abbreviations, urlAbbrev, work } = book;

  abbreviationTable.set(bookName.toLowerCase(), { bookName, work, urlAbbrev });
  abbreviationTable.set(urlAbbrev.toLowerCase(), { bookName, work, urlAbbrev });

  for (const abbr of abbreviations) {
    abbreviationTable.set(abbr.toLowerCase(), { bookName, work, urlAbbrev });
  }
}

/**
 * if book xor chapter are provided it tries to find one that fits.
 * @param {string} [book]
 * @param {string} [chapter]
 */
function getScriptureMastery(book, chapter) {
  const scriptureMasteries = require("../data/gospel/scripture-mastery-reference.json");
  let m = scriptureMasteries;

  if (book) m = scriptureMasteries.filter(s => s.book === book);
  else if (chapter) m = scriptureMasteries.filter(s => s.chapter === chapter);

  const reference = u.rand(m.length === 0 ? scriptureMasteries : m);

  return {
    book: reference.book,
    chapter: reference.chapter,
    verses: reference.verses
  };
}

/**
 * Displays a verse that's requested, or a random verse if none is specified.
 * @param {Discord.ChatInputCommandInteraction | Discord.Message} interaction The interaction that caused this command.
 * @param {Ref} [parsed]
 */
async function slashGospelVerse(interaction, parsed) {
  let book, chapter, verses;

  if (parsed) {
    if (interaction instanceof Discord.ChatInputCommandInteraction) return; // Interaction and parsed are mutually exclusive
    ({ book, chapter, verses } = parsed);
  } else {
    if (interaction instanceof Discord.Message) return;
    book = interaction.options.getString("book", false);
    chapter = interaction.options.getInteger("chapter", false);
    verses = interaction.options.getString("verses", false);
  }

  if (!book || !chapter) {
    // Get a random one from scripture mastery.
    ({ book, chapter, verses } = getScriptureMastery(abbreviationTable.get(book?.toLowerCase() ?? "")?.bookName, chapter?.toString()));
  }

  const intCheck = !parsed && interaction instanceof Discord.ChatInputCommandInteraction;
  const bookRef = abbreviationTable.get(book.toLowerCase());

  if (!bookRef) {
    if (intCheck) interaction.reply({ content: "I don't understand what book you're mentioning.", flags: ["Ephemeral"] });
    return;
  }

  // Parse verses.
  const { versesNums, text } = parseVerseRange(verses ?? undefined);

  // Put together the embed
  const embed = u.embed()
    .setTitle(bookRef.bookName + " " + chapter.toString() + (text ? ":" + text : ""))
    .setURL(`https://www.churchofjesuschrist.org/study/scriptures/${bookRef.work}/${bookRef.urlAbbrev}/${chapter}${(versesNums[0] ? ("." + text.replace(/ /g, "") + "?lang=eng#p" + versesNums[0]) : "?lang=eng")}`)
    .setColor(0x012b57);

  // @ts-ignore
  const bookJson = require("../data/gospel/" + works[bookRef.work] + "-reference.json");
  if (!bookJson[bookRef.bookName][chapter]) {
    if (intCheck) interaction.reply({ content: `That chapter doesn't exist in ${bookRef.bookName}!`, flags: ["Ephemeral"] });
    return;
  }

  /** @type {Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]} */
  const components = [];
  let content;

  if (versesNums.length > 0) {
    /** @type {string[]} */
    const verseContent = [];
    /** @type {Set<string>} */
    const jstLookups = new Set();

    for (const num of versesNums) {
      if (bookJson[bookRef.bookName][chapter][num]) {
        let verse = bookJson[bookRef.bookName][chapter][num];

        const jst = jstRegex.exec(verse);
        if (jst) {
          jstLookups.add(jst[1]);
          verse = verse.replace(jstRegex, "");
        }

        verseContent.push(num.toString() + " " + verse);
      }
    }

    const verseJoinedContent = verseContent.join("\n\n");
    if (verses && verseJoinedContent.length === 0) {
      if (intCheck) interaction.reply({ content: "The verse(s) you requested weren't found.", flags: ["Ephemeral"] });
      return;
    }

    embed.setDescription(verseJoinedContent.length > 2048 ? verseJoinedContent.slice(0, 2048) + "…" : verseJoinedContent);

    if (jstLookups.size > 0) {
      content = "JST is available for this section";
      embed.setFooter({ text: `JST | ${bookRef.bookName} | ${chapter} | ${[...jstLookups].join(",")}` });

      components.push(u.MessageActionRow().addComponents([
        new u.Button().setCustomId("verseJST").setLabel("View JST").setStyle(Discord.ButtonStyle.Primary)
      ]));
    }

  }
  interaction.reply({ content, embeds: [embed], components });
}

/**
 * Splits the verses section in a scripture reference into individual verse numbers.
 * @param {string} [verses] A string containing numbers, spaces, hyphens, and commas.
 * @returns An Array of numbered integers as interpreted. "3-5, 7" returns [3, 4, 5, 7]
 */
function parseVerseRange(verses) {
  /** @type {number[]} */
  let versesNums = [];
  /** @type {string[]} */
  let textVerses = [];

  if (verses) {
    if (verses.charAt(0) === "-") return { versesNums: [], text: "" }; // catch people giving negative verse to be silly

    verses = verses.replace(/ /g, "");
    const versesList = verses.split(/[,;]/);

    // const rangeRegex = /(\d+)(?:-(\d+))?/;
    for (const range of versesList) {
      const [low, high] = range.split("-").map(r => parseInt(r));

      if (!low && !high) {
        return { versesNums: [], text: "" };
      } else if (!high) {
        textVerses.push(`${low}`);
        versesNums.push(low);
      } else {
        let lowNum = low;
        let highNum = high;
        if (lowNum > highNum) [lowNum, highNum] = [highNum, lowNum];

        textVerses.push(`${lowNum}-${highNum}`);
        for (let i = lowNum; i <= highNum; i++) versesNums.push(i);
      }
    }
    // Get unique verses
    versesNums = u.unique(versesNums).sort((a, b) => a - b);
    textVerses = u.unique(textVerses).sort((a, b) => a.localeCompare(b));
  }
  return { versesNums, text: textVerses.join(", ") };
}

/** @param {Date} inputDate */
function calculateDate(inputDate, debug = false) {
  inputDate.setHours(10); // weird moment stuff
  const date = u.moment(inputDate);

  // Set the day to Monday. If the day is Sunday (0), set it to subtract a week
  const monday = date;
  monday.day(monday.day() === 0 ? -6 : 1);

  // Account for the end of the year;
  if (monday.month() === 11 && monday.date() > 25) monday.day(-6);
  const str = `${u.moment(monday).format("MMMM Do YYYY")}`;
  const week = u.moment(monday).format("ww");

  const manual = manuals.get(date.year());
  if (manual) {
    // If a feature gets added to select a date, look at the old code on icarus5.
    // The link is different and 2020 has a gap for conference
    const link = `https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-${manual}/${week.padStart(2, "0")}`;
    if (debug) return `${u.moment(date).format("MM/DD (ddd)")}: Week ${week.padStart(2, "0")}`;
    return { link, str };
  }
  return null;

}

/**
 * @param {Discord.ChatInputCommandInteraction} interaction
 */
function slashGospelComeFollowMe(interaction) {
  const date = calculateDate(new Date());
  if (date && typeof date !== 'string') {
    interaction.reply(`## Come, Follow Me Lesson for the week of ${date.str}:\n${date.link}`);
  } else {
    interaction.reply({ content: `Sorry, I don't have information for the ${new Date().getFullYear()} manual yet.`, flags: ["Ephemeral"] });
  }
}

/** @param {Discord.ChatInputCommandInteraction} interaction */
async function slashGospelNews(interaction) {
  await interaction.deferReply();

  const parser = new Parser();
  const feed = await parser.parseURL("https://newsroom.churchofjesuschrist.org/rss");
  const newsItem = feed.items[0];

  const embed = u.embed()
    .setAuthor({ name: "Newsroom", url: feed.link?.startsWith("http") ? feed.link : "https://" + feed.link, iconURL: "attachment://image.png" })
    .setTitle(newsItem.title || "Title")
    .setURL(newsItem.link || "Url")
    .setDescription((newsItem.content || "Description").replace(/<[\s\S]+?>/g, "")) // Remove all HTML tags from the description
    .setTimestamp(new Date(newsItem.pubDate || 1));

  const image = new u.Attachment('./media/ldsnewsroom.png', { name: "image.png" });
  interaction.editReply({ embeds: [embed], files: [image] });
}

const Module = new Augur.Module()
.addInteraction({
  name: "gospel",
  id: u.sf.commands.slashGospel,
  options: { registry: "slashGospel" },
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
      case "comefollowme": return slashGospelComeFollowMe(interaction);
      case "news": return slashGospelNews(interaction);
      case "verse": return slashGospelVerse(interaction);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), interaction);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused(true);
    // Supply book names
    if (option.name === 'book') {
      const values = u.autocompleteSort(option.value, abbreviationTable)
        .map(b => b.bookName).slice(0, 24);

      return int.respond(u.unique(values).map(v => ({ name: v, value: v })));
    }
  }
})
.addInteraction({
  name: "View JST",
  id: "verseJST",
  type: "Button",
  process: async (int) => {
    await int.deferReply();

    const msg = await int.message.fetch();
    const footer = msg.embeds[0]?.footer?.text;
    if (!footer) return int.editReply("Sorry, I couldn't understand my own message.").then(u.clean);

    const [book, chapter, index] = footer.split(" | ").slice(1);
    const bookRef = books.find(b => b.bookName === book);

    /** @type {string[]} */
    const lines = [];
    const indexes = index.split(",");
    for (const i of indexes) {
      const numIndex = parseInt(i);
      lines.push(jstRef[book][chapter][numIndex].join("\n\n"));
    }

    const embed = u.embed(msg.embeds[0])
      .setTitle(`${book} ${chapter} - JST`)
      .setURL(`https://www.churchofjesuschrist.org/study/scriptures/jst/jst-${bookRef?.urlAbbrev}/${chapter}`)
      .setDescription(lines.join("\n\n------------------\n\n"))
      .setFooter(null);

    await int.editReply({ embeds: [embed] });
    await msg.edit({ components: [] });
  }
})
.addEvent("messageCreate", msg => {
  if (!msg.inGuild()) return;

  if (msg.channel.parent?.id === u.sf.channels.gospelCategory && !u.parse(msg) && !msg.author.bot) {
    const match = searchExp.exec(msg.cleanContent);
    if (!match) return;

    return slashGospelVerse(msg, { book: match[1], chapter: match[2], verses: match[3] });
  }
})
.addCommand({ name: "debugcfm",
  permissions: (msg) => u.perms.calc(msg.member, ["botAdmin"]),
  process: (msg) => {
    const fakeDay = new Date("Dec 31 2023");
    let i = 0;

    const dates = new u.Collection();
    while (i <= 365) {
      fakeDay.setDate(fakeDay.getDate() + 1);
      const calc = calculateDate(fakeDay, true);

      if (dates.has(calc)) dates.set(calc, dates.get(calc) + 1);
      else dates.set(calc, 1);

      i++;
    }

    msg.reply(`Results:\n\`\`\`${dates.map((v, k) => `${k} => ${v}/7 days`).join("\n")}\`\`\``);
  }
})
.setInit(() => {
  books.map(refAbbrBuild);
  searchExp = new RegExp(`\\b(${[...abbreviationTable.keys()].join("|")})\\W(\\d+)[: ]?([\\d\\-;,\\W]+)`, "ig");
});


module.exports = Module;