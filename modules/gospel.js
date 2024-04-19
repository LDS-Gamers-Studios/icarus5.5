// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const Parser = require("rss-parser");
const u = require("../utils/utils");
const books = require("../data/gospel/books.json");

const abbreviationTable = new Map(); // abbreviation: { bookName, work }

books.forEach(([bookName, urlAbbrev, work, abbreviations = []]) => {
  if (typeof bookName === 'string' && typeof urlAbbrev === 'string' && typeof work === 'string' && Array.isArray(abbreviations)) {
    refAbbrBuild(bookName, urlAbbrev, work, abbreviations);
  }
});

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
  [2024, "book-of-mormon-2024"]
]);

/**
 * Builds the abbreviation lookup table for books of scripture.
 * @param {String} bookName The canonical book name. Ex: "Song of Solomon"
 * @param {String[]} abbreviations An array of abbreviations, in lowercase. Ex: ["song", "sos"], ["dc", "d&c"]
 * @param {String} work The abbreviation for the work it's from, according to the Church URL. Ex: "ot", "bofm", "dc-testament"
 * @param {String} urlAbbrev The abbreviation for the chapter in the link. For 1 Nephi, this is 1-ne.
 * @return This method mutates the lookup array.
 */
function refAbbrBuild(bookName, urlAbbrev, work, abbreviations = []) {
  abbreviationTable.set(bookName.toLowerCase(), { bookName, work, urlAbbrev });
  abbreviationTable.set(urlAbbrev.toLowerCase(), { bookName, work, urlAbbrev });
  for (const abbr of abbreviations) {
    abbreviationTable.set(abbr.toLowerCase(), { bookName, work, urlAbbrev });
  }
}

function getScriptureMastery() {
  const scriptureMasteries = require("../data/gospel/scripture-mastery-reference.json");
  const reference = u.rand(scriptureMasteries);
  return {
    book: reference[0],
    chapter: reference[1],
    verses: reference[2]
  };
}

/**
 * Displays a verse that's requested, or a random verse if none is specified.
 * @param {Discord.ChatInputCommandInteraction} interaction The interaction that caused this command.
 */
async function slashGospelVerse(interaction) {
  let book = interaction.options.getString("book", false);
  let chapter = interaction.options.getString("chapter", false);
  let verses = interaction.options.getString("verses", false);
  if (!book || !chapter || !verses) {
    // Get a random one from scripture mastery.
    ({ book, chapter, verses } = getScriptureMastery());
  }

  const bookRef = abbreviationTable.get(book.toLowerCase());
  if (!bookRef) {
    interaction.reply({ content: "I don't understand what book you're mentioning.", ephemeral: true });
    return;
  }

  // Parse verses.
  let versesNums;
  try {
    versesNums = parseVerseRange(verses);
  } catch (e) {
    if (e instanceof SyntaxError) {
      interaction.reply({ content: "I don't understand what verses you're looking for.", ephemeral: true });
      return;
    } else {
      throw e;
    }
  }
  // Put together the embed
  const embed = u.embed()
    .setTitle(bookRef.bookName + " " + chapter.toString() + (versesNums[0] ? ":" + verses : ""))
    .setURL(`https://www.churchofjesuschrist.org/study/scriptures/${bookRef.work}/${bookRef.urlAbbrev}/${chapter}${(versesNums[0] ? ("." + verses + "?lang=eng#p" + versesNums[0]) : "?lang=eng")}`);
  const bookJson = require("../data/gospel/" + works[bookRef.work] + "-reference.json");
  if (!bookJson[bookRef.bookName][chapter]) {
    interaction.reply({ content: `That chapter doesn't exist in ${bookRef.bookName}!`, ephemeral: true });
    return;
  }
  const verseContent = [];
  for (const num of versesNums) {
    if (bookJson[bookRef.bookName][chapter][num]) {
      verseContent.push(num.toString() + " " + bookJson[bookRef.bookName][chapter][num]);
    }
  }
  const verseJoinedContent = verseContent.join("\n\n");
  if (verses && verseJoinedContent.length === 0) {
    interaction.reply({ content: "The verse(s) you requested weren't found.", ephemeral: true });
    return;
  }
  embed.setDescription(verseJoinedContent.length > 2048 ? verseJoinedContent.slice(0, 2048) + "…" : verseJoinedContent);
  embed.setColor(0x012b57);
  interaction.reply({ embeds: [embed] });
}

/**
 * Splits the verses section in a scripture reference into individual verse numbers.
 * @param {string} verses A string containing numbers, spaces, hyphens, and commas.
 * @returns An Array of numbered integers as interpreted. "3-5, 7" returns [3, 4, 5, 7]
 */
function parseVerseRange(verses) {
  let versesNums;
  if (verses) {
    if (verses.charAt(0) == "-") throw new SyntaxError("Invalid verse range."); // catch people giving negative verse to be silly
    verses = verses.replace(/ /g, "");
    const versesList = verses.split(/[,;]/);
    versesNums = [];
    const rangeRegex = /(\d+)(?:-(\d+))?/;
    for (const range of versesList) {
      const results = range.match(rangeRegex);
      const [low, high] = results ? [results[1], results[2]] : [null, null];
      if (!low) {
        throw new SyntaxError("Invalid verse range.");
      } else if (!high) {
        versesNums.push(parseInt(low));
      } else {
        let lowNum = parseInt(low);
        let highNum = parseInt(high);
        // Swap the range if it's out of order.
        if (lowNum > highNum) {
          [lowNum, highNum] = [highNum, lowNum];
        }
        for (let i = lowNum; i <= highNum; i++) {
          versesNums.push(i);
        }
      }
    }
    // Get unique verses
    versesNums = [...new Set(versesNums)].sort((a, b) => a - b);
  } else { versesNums = []; }
  return versesNums;
}

async function slashGospelComeFollowMe(interaction) {
  // Most of this function is old code. Not sure how to improve it.
  let date = new Date();
  date.setHours(0, 0, 0, 0);
  const displayDate = new Date(date);
  let jan1;
  // Account for year-end dates.
  if (date.getMonth() == 11 && (date.getDate() - date.getDay() >= 26)) {
    jan1 = new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0);
    date = jan1;
  } else {
    jan1 = new Date(date.getFullYear(), 0, 1, 0, 0, 0);
  }

  const manual = manuals.get(date.getFullYear());
  if (manual) {
    // Add full weeks and check partial weeks by day of week comparison
    const week = ((date.getDay() + 6) % 7 < (jan1.getDay() + 6) % 7 ? 2 : 1) + Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24 * 7));
    // Account for General Conference - this was needed in 2020 but is kept here commented in case it's needed again.
    // if ((date.getMonth() == 3 && (date.getDate() - date.getDay()) >= 0) || date.getMonth() > 3) week -= 1;
    // if ((date.getMonth() == 9 && (date.getDate() - date.getDay()) >= 0) || date.getMonth() > 9) week -= 1;

    // Current implementation only gets the current manual, but im leaving this extra functionality for URL format in case we ever expand off it to get any past entreis
    const link = date.getFullYear() < 2024 ? `https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-individuals-and-families-${manual}/${week.toString().padStart(2, "0")}` : `https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-${manual}/${week.toString().padStart(2, "0")}`;

    // This would be cool as an embed, but I think Discord's built in style is better.
    interaction.reply(`__Come, Follow Me Lesson for the week of ${displayDate.toLocaleDateString()}:__\n${link}`);
  } else {
    interaction.reply({ content:`Sorry, I don't have information for the ${date.getFullYear()} manual yet.`, ephemeral: true });
  }
}

async function slashGospelNews(interaction) {
  const parser = new Parser();
  const url = "https://newsroom.churchofjesuschrist.org/rss";
  const author = "Newsroom";
  const feed = await parser.parseURL(url);
  const newsItem = feed.items[0];
  const embed = u.embed()
    .setAuthor({ name: author, url: feed.link?.startsWith("http") ? feed.link : "https://" + feed.link })
    .setTitle(newsItem.title || "Title")
    .setURL(newsItem.link || "Url")
    .setDescription((newsItem.content || "Description").replace(/<[\s\S]+?>/g, "")) // Remove all HTML tags from the description
    .setTimestamp(new Date(newsItem.pubDate || 1));
  interaction.reply({ embeds: [embed] });

}

const Module = new Augur.Module()
  .setInit(() => {
    // init code
  })
  .addInteraction({
    name: "gospel",
    id: u.sf.commands.slashGospel,
    process: async (interaction) => {
      switch (interaction.options.getSubcommand(true)) {
      case "verse":
        await slashGospelVerse(interaction);
        break;
      case "comefollowme":
        await slashGospelComeFollowMe(interaction);
        break;
      case "news":
        await slashGospelNews(interaction);
        break;
      }
    }
  });

module.exports = Module;