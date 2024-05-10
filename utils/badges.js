//@ts-check

// Gets the badges that belong to the user based on a list of roles.

const u = require("../utils/utils"),
Discord = require("discord.js");

const badges = new Map()
  // Staff roles
  .set(u.sf.roles.founder, { title: "LDSG Founder", image: "team_founder.png", desc: "Lord of the Beans", overrides: [u.sf.roles.management, u.sf.roles.team, u.sf.roles.gameskeeper, u.sf.roles.mod] })
  .set(u.sf.roles.management, { title: "LDSG Management", image: "team_management.png", desc: "Helps things run smoothly by directing the overall vision of the community.", overrides: [u.sf.roles.team, u.sf.roles.gameskeeper, u.sf.roles.mod] })
  .set(u.sf.roles.team, { title: "LDSG Team", image: "team_team.png", desc: "Helps things move smoothly in an area of expertise.", overrides: [u.sf.roles.gameskeeper, u.sf.roles.mod] })
  .set(u.sf.roles.mod, { title: "Discord Moderator", image: "team_moderator.png", desc: "Keeper of the peace, wielder of the hammer." })
  .set(u.sf.roles.gameskeeper, { title: "LDSG Gameskeeper", image: "team_gameskeeper.png", desc: "Helps run a guild, club, clan, tribe, or something for LDSG." })
  .set(u.sf.roles.minecraftmod, { title: "LDSG Minecraft Mod", image: "team_minecraft.png", desc: "A moderator on the LDSG Minecraft Servers" })

  // Lion house roles (now with 100% fewer lions!)
  .set(u.sf.roles.housebb, { title: "House Brightbeam", image: "bb-badge.png", desc: "House Brightbeam - Bastion of the Light" })
  .set(u.sf.roles.housefb, { title: "House Freshbeast", image: "fb-badge.png", desc: "House Freshbeast - Thunder from the Mountains" })
  .set(u.sf.roles.housesc, { title: "House Starcamp", image: "sc-badge.png", desc: "House Starcamp - In Pursuit of the Stars" })
  // Do Heads of Household want their own badges?

  // Sponsor roles
  .set(u.sf.roles.sponsors.legendary, { title: "Legendary Sponsor", image: "sponsor_legendary.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you.", overrides: sponsorRolesOverrides(u.sf.roles.sponsors.legendary) })
  .set(u.sf.roles.sponsors.pro, { title: "Pro Sponsor", image: "sponsor_pro.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you.", overrides: sponsorRolesOverrides(u.sf.roles.sponsors.pro) })
  .set(u.sf.roles.sponsors.onyx, { title: "Onyx Sponsor", image: "sponsor_onyx.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you.", overrides: sponsorRolesOverrides(u.sf.roles.sponsors.onyx) })
  .set(u.sf.roles.sponsors.elite, { title: "Elite Sponsor", image: "sponsor_elite.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you.", overrides: sponsorRolesOverrides(u.sf.roles.sponsors.elite) })
  .set(u.sf.roles.sponsors.twitch, { title: "Twitch Subscriber", image: "sponsor_twitch.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you.", overrides: sponsorRolesOverrides(u.sf.roles.sponsors.twitch) })
  .set(u.sf.roles.sponsors.donator, { title: "Donator", image: "sponsor_donator.png", desc: "Your generous donation lets us know you care about the community. You have our sincerest thanks, you awesome person, you." })

  // Experience roles
  .set(u.sf.roles.experience.ancient, { title: "Ancient Member", image: "chat_ancient.png", desc: "Attained the rank of Ancient in the LDSG Discord Server for participation in conversations.", overrides: experienceRolesOverrides(u.sf.roles.experience.ancient) })
  .set(u.sf.roles.experience.legend, { title: "Legendary Member", image: "chat_legend.png", desc: "Attained the rank of Legend in the LDSG Discord Server for participation in conversations.", overrides: experienceRolesOverrides(u.sf.roles.experience.legend) })
  .set(u.sf.roles.experience.hero, { title: "Hero Member", image: "chat_hero.png", desc: "Attained the rank of Hero in the LDSG Discord Server for participation in conversations.", overrides: experienceRolesOverrides(u.sf.roles.experience.hero) })
  .set(u.sf.roles.experience.veteran, { title: "Veteran Member", image: "chat_veteran.png", desc: "Attained the rank of Veteran in the LDSG Discord Server for participation in conversations.", overrides: experienceRolesOverrides(u.sf.roles.experience.veteran) })
  .set(u.sf.roles.experience.novice, { title: "Novice Member", image: "chat_novice.png", desc: "Attained the rank of Novice in the LDSG Discord Server for participation in conversations." })

  // Membership roles
  .set(u.sf.roles.membership.year1, { title: "Member - 1 Years", image: "anniversary-1.png", desc: "A member of the LDS Gamers Discord Community for 1 Year!" })
  .set(u.sf.roles.membership.year2, { title: "Member - 2 Years", image: "anniversary-2.png", desc: "A member of the LDS Gamers Discord Community for 2 Years!", overrides: membershipRolesOverrides(u.sf.roles.membership.year2) })
  .set(u.sf.roles.membership.year3, { title: "Member - 3 Years", image: "anniversary-3.png", desc: "A member of the LDS Gamers Discord Community for 3 Years!", overrides: membershipRolesOverrides(u.sf.roles.membership.year3) })
  .set(u.sf.roles.membership.year4, { title: "Member - 4 Years", image: "anniversary-4.png", desc: "A member of the LDS Gamers Discord Community for 4 Years!", overrides: membershipRolesOverrides(u.sf.roles.membership.year4) })
  .set(u.sf.roles.membership.year5, { title: "Member - 5 Years", image: "anniversary-5.png", desc: "A member of the LDS Gamers Discord Community for 5 Years! Wow!", overrides: membershipRolesOverrides(u.sf.roles.membership.year5) })
  .set(u.sf.roles.membership.year6, { title: "Member - 6 Years", image: "anniversary-6.png", desc: "A member of the LDS Gamers Discord Community for 6 Years! Wow!", overrides: membershipRolesOverrides(u.sf.roles.membership.year6) })
  .set(u.sf.roles.membership.year7, { title: "Member - 7 Years", image: "anniversary-7.png", desc: "A member of the LDS Gamers Discord Community for 7 Years! Wow!", overrides: membershipRolesOverrides(u.sf.roles.membership.year7) })
  .set(u.sf.roles.membership.year8, { title: "Member - 8 Years", image: "anniversary-8.png", desc: "A member of the LDS Gamers Discord Community for 8 Years! Wow!", overrides: membershipRolesOverrides(u.sf.roles.membership.year8) })
  .set(u.sf.roles.membership.year9, { title: "Member - 9 Years", image: "anniversary-9.png", desc: "A member of the LDS Gamers Discord Community for 9 Years! Wow!", overrides: membershipRolesOverrides(u.sf.roles.membership.year9) })
  .set(u.sf.roles.membership.year10, { title: "Member - 10 Years", image: "anniversary-10.png", desc: "A member of the LDS Gamers Discord Community for 10+ Years! Thanks for sticking around!", overrides: membershipRolesOverrides(u.sf.roles.membership.year10) })

  // Platform roles
  .set(u.sf.roles.platform.pc, { title: "PC Gamer", image: "platform_pc.png", desc: "You are a PC Gamer. The Master Race. Half Life 3 Confirmed." })
  .set(u.sf.roles.platform.xbox, { title: "Xbox Gamer", image: "platform_xb.png", desc: "You are an Xbox Gamer. It's not a mini fridge, despite its looks." })
  .set(u.sf.roles.platform.playstation, { title: "Playstation Gamer", image: "platform_ps.png", desc: "You game on the Playstation. So it DOES have games!" })
  .set(u.sf.roles.platform.nintendo, { title: "Nintendo Gamer", image: "platform_nin.png", desc: "You game on the Nintendo. You spend hours of your life stomping... koopas." })

/**
 * @param {string} roleId
 */
function sponsorRolesOverrides(roleId) {
  const sponsors = [
    u.sf.roles.sponsors.legendary,
    u.sf.roles.sponsors.pro,
    u.sf.roles.sponsors.onyx,
    u.sf.roles.sponsors.elite,
    u.sf.roles.sponsors.twitch,
    u.sf.roles.sponsors.donator
  ];
  let index = sponsors.indexOf(roleId);
  return sponsors.slice(index + 1);
}

/**
 * @param {string} roleId
 */
function experienceRolesOverrides(roleId) {
  const experience = [
    u.sf.roles.experience.ancient,
    u.sf.roles.experience.legend,
    u.sf.roles.experience.hero,
    u.sf.roles.experience.veteran,
    u.sf.roles.experience.novice
  ];
  let index = experience.indexOf(roleId);
  return experience.slice(index + 1);
}

/**
 * @param {string} roleId
 */
function membershipRolesOverrides(roleId) {
  const membership = [
    u.sf.roles.membership.year10,
    u.sf.roles.membership.year9,
    u.sf.roles.membership.year8,
    u.sf.roles.membership.year7,
    u.sf.roles.membership.year6,
    u.sf.roles.membership.year5,
    u.sf.roles.membership.year4,
    u.sf.roles.membership.year3,
    u.sf.roles.membership.year2,
    u.sf.roles.membership.year1
  ];
  let index = membership.indexOf(roleId);
  return membership.slice(index + 1);

}

/**
 * 
 * @param {Array<Discord.Role>} roles 
 * @returns {Array<{title: string, image: string, desc: string, overrides: Array<String>?}>}
 */
function getBadges(roles) {
  let overrides = [];
  let userBadges = [];
  let sortedRoles = Array.from(roles.values())
    .sort((a, b) => b.position - a.position)
    .forEach((role => {
      // If the role isn't overridden, there's a badge for it, and the user doesn't already have 10 badges,
      // then add it to the badges list.
      if (!overrides.includes(role.id) && badges.has(role.id) && (userBadges.length < 10)) {
        userBadges.push(badges.get(role.id));
        if (badges.get(role.id).overrides) { badges.get(role.id).overrides.forEach(override => overrides.push(override)) }
      }
    }))
  return userBadges;
}

module.exports = getBadges