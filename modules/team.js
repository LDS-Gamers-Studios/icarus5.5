// @ts-check
const Augur = require("augurbot-ts");
const u = require("../utils/utils");
const c = require("../utils/modCommon");

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamRoleGive(int, give = true) {
  try {
    await int.deferReply({ flags: ["Ephemeral"] });
    const recipient = int.options.getMember("user");
    if (!recipient) return int.editReply("I couldn't find that user!");

    const input = int.options.getString("role", true).toLowerCase();
    const role = u.db.sheets.roles.team.find(r => r.base.name.toLowerCase() === input);
    if (!role) return int.editReply("I couldn't find that role!");

    if (!u.perms.calc(int.member, [role.level])) return int.editReply(`You don't have the right permissions to ${give ? "give" : "take"} this role.`);

    const response = await c.assignRole(int, recipient, role.base, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamBankAward(int) {
  try {
    /** @type {import("./bank").BankShared} */
    const bankUtils = int.client.moduleManager.shared.get("bank.js");
    if (!bankUtils) throw new Error("Could not access bank utilities from shared.");
    const { ember, gb, limit } = bankUtils;

    const giver = int.member;
    const recipient = int.options.getMember("user");
    const reason = int.options.getString("reason") || "Astounding feats of courage, wisdom, and heart";

    let value = int.options.getInteger("amount", true);
    if (!recipient) return int.reply({ content: "I couldn't find that user!", flags: ["Ephemeral"] });

    let reply = "";

    if (recipient.id === giver.id) {
      reply = `You can't award ***yourself*** ${ember}, silly.`;
    } else if (recipient.id === int.client.user.id) {
      reply = `You can't award ***me*** ${ember}, silly.`;
    } else if (recipient.user.bot) {
      reply = `Bots don't really have a use for awarded ${ember}.`;
    } else if (value === 0) {
      reply = "You can't award ***nothing***.";
    }

    if (reply) return int.reply({ content: reply, flags: ["Ephemeral"] });

    value = value < 0 ? Math.max(value, -1 * limit.ember) : Math.min(value, limit.ember);

    const award = {
      currency: "em",
      discordId: recipient.id,
      description: `House Points: ${reason}`,
      value,
      otherUser: giver.id,
      hp: true
    };

    const receipt = await u.db.bank.addCurrency(award);
    const balance = await u.db.bank.getBalance(recipient.id);

    const str = (/** @type {string} */ m) => value > 0 ? `awarded ${m} ${ember}${receipt.value}` : `docked ${ember}${-receipt.value} from ${m}`;
    let embed = u.embed({ author: int.client.user })
      .addFields(
        { name: "Reason", value: reason },
        { name: "Your New Balance", value: `${gb}${balance.gb}\n${ember}${balance.em}` }
      )
      .setDescription(`${u.escapeText(giver.displayName)} just ${str("you")}! This counts toward your House's Points.`);

    await int.reply(`Successfully ${str(recipient.displayName)} for ${reason}. This counts towards their House's Points.`);
    recipient.send({ embeds: [embed] }).catch(() => int.followUp({ content: `I wasn't able to alert ${recipient} about the award. Please do so yourself.`, flags: ["Ephemeral"] }));
    u.clean(int, 60000);

    const house = u.getHouseInfo(recipient);

    embed = u.embed({ author: recipient })
      .setColor(house.color)
      .addFields(
        { name: "House", value: house.name },
        { name: "Reason", value: reason }
      )
      .setDescription(`**${giver}** ${str(recipient.toString())}`);
    int.client.getTextChannel(u.sf.channels.houses.awards)?.send({ embeds: [embed], content: recipient.toString(), allowedMentions: { parse: ["users"] } });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamTournamentChampions(int) {
  await int.deferReply({ flags: ["Ephemeral"] });
  const tName = int.options.getString('tournament');

  /** @param {string} str */
  const user = (str) => int.options.getMember(str);
  const users = u.unique([user('1'), user('2'), user('3'), user('4'), user('5'), user('6')].filter(usr => usr));
  const date = u.moment().add(3, "weeks").toDate();

  await u.db.sheets.tourneyChampions.update(users.map(usr => ({
    tourneyName: tName || "",
    userId: usr?.id || "",
    takeAt: date,
    key: u.customId(5)
  })));

  for (const usr of users) {
    usr?.roles.add(u.sf.roles.tournament.champion);
  }

  const s = users.length > 1 ? 's' : '';
  const content = `## 🏆 Congratulations to our new tournament champion${s}! 🏆\n` +
    `${users.join(", ")}!\n\nTheir performance landed them the champion slot in the ${tName} tournament, and they'll hold on to the LDSG Tourney Champion role for a few weeks.`;
  int.client.getTextChannel(u.sf.channels.announcements)?.send({ content, allowedMentions: { parse: ["users"] } });
  int.editReply("Champions recorded and announced!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamTournamentReset(int) {
  await int.deferReply({ flags: ["Ephemeral"] });

  const role = int.guild.roles.cache.get(u.sf.roles.tournament.participant);
  if (!role) throw new Error("Missing Tournament Participant Role");

  let succeeded = 0;
  const members = role.members;
  for (const member of members) {
    await member[1].roles.remove(role.id).catch(() => succeeded--);
    succeeded++;
  }

  return int.editReply(`Removed ${succeeded}/${members.size} people from the ${role} role`);
}


const Module = new Augur.Module()
.addInteraction({ id: u.sf.commands.slashTeam,
  onlyGuild: true,
  permissions: int => u.perms.calc(int.member, ["team", "mgr"]),
  process: (int) => {
    const group = int.options.getSubcommandGroup(true);
    switch (int.options.getSubcommand()) {
      case "give": return slashTeamRoleGive(int, true);
      case "take": return slashTeamRoleGive(int, false);
      case "award": return slashTeamBankAward(int);
      case "champions": return slashTeamTournamentChampions(int);
      case "reset": {
        if (group === "tournament") return slashTeamTournamentReset(int);
        return u.errorHandler(new Error("Unhandled Subcommand"), int);
      }
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused(true);
    const sub = int.options.getSubcommand(true);
    if (["give", "take"].includes(sub) && option.name === "role") {
      const withPerms = u.db.sheets.roles.team.filter(r => {
        if (option.value && !r.base.name.toLowerCase().includes(option.value.toLowerCase())) return;

        return u.perms.calc(int.member, [r.level]);
      })
        .sort((a, b) => b.base.comparePositionTo(a.base))
        .map(r => r.base.name)
        .slice(0, 24);

      return int.respond(withPerms.map(r => ({ name: r, value: r })));
    }
  }
});

module.exports = Module;