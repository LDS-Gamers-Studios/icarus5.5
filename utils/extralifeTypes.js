// @ts-check

/**
 * @typedef Team
 * @prop {number} numParticipants
 * @prop {number} fundraisingGoal
 * @prop {Record<string, string>} links
 * @prop {boolean} streamIsLive
 * @prop {number} numIncentives
 * @prop {number} sumDonations
 * @prop {string} name
 * @prop {number} numMilestones
 * @prop {string} avatarImageURL
 * @prop {number} teamID
 * @prop {number} sumPledges
 * @prop {string} streamingChannel
 * @prop {number} numDonations
 * @prop {Participant[]} participants
 * @prop {Milestone[]} milestones
 *
 * @typedef Milestone
 * @prop {string} description
 * @prop {number} fundraisingGoal
 * @prop {boolean} isActive
 * @prop {boolean} [isComplete]
 * @prop {string} milestoneID
 *
 * @typedef Donation
 * @prop {string} displayName
 * @prop {string} donorId
 * @prop {string} recipientName
 * @prop {string} recipientImageURL
 * @prop {string} message
 * @prop {number} participantID
 * @prop {number} amount
 * @prop {string} avatarImageURL
 * @prop {string} donationID
 * @prop {string} createdDateUTC
 * @prop {string} [incentiveID]
 *
 * @typedef ParticipantExclusive
 * @prop {string} eventName
 * @prop {boolean} isTeamCoCaptain
 * @prop {number} participantID
 * @prop {string} teamName
 * @prop {string} displayName
 * @prop {string} participantTypeCode
 * @prop {boolean} isTeamCaptain
 *
 * @typedef {Omit<Team, "numParticipants"|"streamIsLive"|"name"|"streamingChannel"> & ParticipantExclusive} Participant
 */


module.exports = { };