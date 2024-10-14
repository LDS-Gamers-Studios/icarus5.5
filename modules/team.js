// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../utils/utils");
const c = require("../utils/modCommon");
const { bankVars } = require("./bank");

/**
 * @typedef {"team"|"mod"|"mgr"|"mgmt"} perms
 * @type {{role: Discord.Role, permissions: perms}[]}
 */
let teamAddRoles;

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamRoleGive(int, give = true) {
  try {
    await int.deferReply({ ephemeral: true });
    const recipient = int.options.getMember("user");
    if (!recipient) return int.editReply("I couldn't find that user!");
    const input = int.options.getString("role", true);
    const role = teamAddRoles.find(r => r.role.name.toLowerCase() === input.toLowerCase());
    if (!role) return int.editReply("I couldn't find that role!");
    if (!u.perms.calc(int.member, [role.permissions])) return int.editReply(`You don't have the right permissions to ${give ? "give" : "take"} this role.`);
    const response = await c.assignRole(int, recipient, role.role, give);
    return int.editReply(response);
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {Discord.GuildMember} member */
function getHouseInfo(member) {
  const houseInfo = new Map([
    [u.sf.roles.housebb, { name: "Brightbeam", color: 0x00a1da }],
    [u.sf.roles.housefb, { name: "Freshbeast", color: 0xfdd023 }],
    [u.sf.roles.housesc, { name: "Starcamp", color: 0xe32736 }]
  ]);

  for (const [k, v] of houseInfo) {
    if (member.roles.cache.has(k)) return v;
  }
  return { name: "Unsorted", color: 0x402a37 };
}

/** @param {Augur.GuildInteraction<"CommandSlash">} interaction */
async function slashTeamBankAward(interaction) {
  try {
    const { ember, gb, limit } = bankVars;
    const giver = interaction.member;
    const recipient = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Astounding feats of courage, wisdom, and heart";
    let value = interaction.options.getInteger("amount", true);
    if (!recipient) return interaction.reply({ content: "I couldn't find that user!", ephemeral: true });

    let reply = "";

    if (recipient.id === giver.id) {
      reply = `You can't award ***yourself*** ${ember}, silly.`;
    } else if (recipient.id !== interaction.client.user.id && recipient.user.bot) {
      reply = `Bots don't really have a use for awarded ${ember}.`;
    } else if (value === 0) {
      reply = "You can't award ***nothing***.";
    }

    if (reply) return interaction.reply({ content: reply, ephemeral: true });

    value = value < 0 ? Math.max(value, -1 * limit.ember) : Math.min(value, limit.ember);

    const award = {
      currency: "em",
      discordId: recipient.id,
      description: `From ${giver.displayName} (House Points): ${reason}`,
      value,
      giver: giver.id,
      hp: true
    };

    const receipt = await u.db.bank.addCurrency(award);
    const balance = await u.db.bank.getBalance(recipient.id);
    const str = (/** @type {string} */ m) => value > 0 ? `awarded ${m} ${ember}${receipt.value}` : `docked ${ember}${-receipt.value} from ${m}`;
    let embed = u.embed({ author: interaction.client.user })
      .addFields(
        { name:"Reason", value: reason },
        { name: "Your New Balance", value: `${gb}${balance.gb}\n${ember}${balance.em}` }
      )
      .setDescription(`${u.escapeText(giver.displayName)} just ${str("you")}! This counts toward your House's Points.`);

    await interaction.reply(`Successfully ${str(recipient.displayName)} for ${reason}. This counts towards their House's Points.`);
    recipient.send({ embeds: [embed] }).catch(() => interaction.followUp({ content: `I wasn't able to alert ${recipient} about the award. Please do so yourself.`, ephemeral: true }));
    u.clean(interaction, 60000);

    const house = getHouseInfo(recipient);

    embed = u.embed({ author: recipient })
      .setColor(house.color)
      .addFields(
        { name: "House", value: house.name },
        { name: "Reason", value: reason }
      )
      .setDescription(`**${giver}** ${str(recipient.toString())}`);
    interaction.client.getTextChannel(u.sf.channels.mopbucketawards)?.send({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamTournamentChampions(int) {
  await int.deferReply({ ephemeral: true });
  const tName = int.options.getString('tournament');
  const user = (str) => int.options.getMember(str);
  const users = u.unique([user('1'), user('2'), user('3'), user('4'), user('5'), user('6')].map(usr => usr?.id).filter(usr => usr !== null));
  const date = new Date(Date.now() + (3 * 7 * 24 * 60 * 60 * 1000)).valueOf();

  await u.db.sheets.data.doc?.sheetsByTitle["Tourney Champions"]?.addRows(users.map(usr => ({ "Tourney Name": tName || "", "User ID": usr ?? "", "Take Role At": date })));
  const members = users.map(usr => int.guild.members.cache.get(usr ?? "")).filter(m => m !== undefined);
  members.forEach(m => m.roles.add(u.sf.roles.champion));

  const s = users.length > 1 ? 's' : '';
  int.client.getTextChannel(u.sf.channels.announcements)?.send(`## Congratulations to our new tournament champion${s}!\n${members.join(", ")}!\n\nTheir performance landed them the champion slot in the ${tName} tournament, and they'll hold on to the LDSG Tourney Champion role for a few weeks.`);
  int.editReply("Champions recorded and announced!");
}

/** @param {Augur.GuildInteraction<"CommandSlash">} int */
async function slashTeamTournamentReset(int) {
  await int.deferReply({ ephemeral: true });
  const role = int.guild.roles.cache.get(u.sf.roles.tournamentparticipant);
  if (!role) throw new Error("Missing Tournament Participant Role");
  let succeeded = 0;
  let i = 0;
  const members = role.members;
  while (i < members.size) {
    const member = members.at(i);
    try {
      await member?.roles.remove(role.id);
      succeeded++;
    } catch (error) {null;}
    i++;
  }
  return int.editReply(`Removed ${succeeded}/${members.size} people from the ${role} role`);
}

const Module = new Augur.Module()
.addInteraction({ id: u.sf.commands.slashTeam,
  onlyGuild: true,
  permissions: int => u.perms.calc(int.member, ["team", "mgr"]),
  process: (int) => {
    switch (int.options.getSubcommand()) {
      case "give": return slashTeamRoleGive(int, true);
      case "take": return slashTeamRoleGive(int, false);
      case "award": return slashTeamBankAward(int);
      case "champions": return slashTeamTournamentChampions(int);
      case "reset": return slashTeamTournamentReset(int);
      default: return u.errorHandler(new Error("Unhandled Subcommand"), int);
    }
  },
  autocomplete: (int) => {
    const option = int.options.getFocused(true);
    const sub = int.options.getSubcommand(true);
    if (["give", "take"].includes(sub) && option.name === "role") {
      const withPerms = teamAddRoles.filter(r => {
        if (option.value && !r.role.name.toLowerCase().includes(option.value.toLowerCase())) return;
        /** @type {("mgr"|"mod"|"team")[]} */
        const permArr = ['mgr'];
        if (r.permissions === 'mod') permArr.push("mod");
        if (['team', 'mod'].includes(r.permissions)) permArr.push("team");
        return u.perms.calc(int.member, permArr);
      }).sort((a, b) => b.role.comparePositionTo(a.role)).map(r => r.role.name);
      return int.respond(withPerms.map(r => ({ name: r, value: r })));
    }
  }
})
.setInit(() => {
  try {
    const ldsg = Module.client.guilds.cache.get(u.sf.ldsg);
    if (!ldsg) throw new Error("LDSG is unavailable");
    // @ts-expect-error trust. (as long as its right in the sheet lol)
    teamAddRoles = u.db.sheets.roles.filter(f => f.type === 'Team Assign').map(r => {
      const role = ldsg.roles.cache.get(r.base);
      if (!role) throw new Error(`Missing Role for Team Assign ID ${r.base}`);
      return { role, permissions: r.level };
    });
  } catch (error) {
    u.errorHandler(error, "Load Team Givable Roles");
  }
});

module.exports = Module;