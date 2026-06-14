const { prisma } = require('../config/database');
const { ValidationError } = require('../utils/errors');

/**
 * Emergency Contacts Service
 * Manages society-specific emergency numbers and provides instructions.
 */

// Default contacts shared by all societies
const DEFAULT_CONTACTS = [
  { name: 'Police', number: '100', type: 'POLICE' },
  { name: 'Fire', number: '101', type: 'FIRE' },
  { name: 'Ambulance', number: '102', type: 'MEDICAL' },
  { name: 'Women Helpline', number: '1091', type: 'OTHER' }
];

// Instructions by alert type
const EMERGENCY_INSTRUCTIONS = {
  MEDICAL: [
    "Call an ambulance immediately if not already done.",
    "Provide first aid if you are trained.",
    "Do not move the injured person unless there is immediate danger.",
    "Clear the path for emergency responders."
  ],
  FIRE: [
    "Activate the fire alarm.",
    "Evacuate the building immediately using the stairs.",
    "Call the fire department.",
    "Use a fire extinguisher only if the fire is small and you are safe."
  ],
  SECURITY: [
    "Lock all doors and stay away from windows.",
    "Call the police.",
    "Alert all guards and society management.",
    "Do not confront the intruder yourself."
  ],
  OTHER: [
    "Assess the situation carefully.",
    "Contact the nearest relevant authority.",
    "Inform the society security room.",
    "Follow any specific protocols provided by management."
  ]
};

// In-memory cache for society-specific contacts (24 hours)
const contactsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const emergencyContactsService = {
  /**
   * 1. Get Emergency Contacts
   * Returns merged list of default and society-specific contacts.
   */
  async getEmergencyContacts(societyId) {
    const now = Date.now();
    const cached = contactsCache.get(societyId);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return cached.data;
    }

    const societyContacts = await prisma.emergencyContact.findMany({
      where: { societyId }
    });

    const result = {
      default: DEFAULT_CONTACTS,
      society: societyContacts
    };

    contactsCache.set(societyId, {
      data: result,
      timestamp: now
    });

    return result;
  },

  /**
   * 2. Update Emergency Contacts (Admin)
   */
  async updateEmergencyContacts(societyId, contacts) {
    if (!Array.isArray(contacts)) {
      throw new ValidationError("Contacts must be an array");
    }

    // Validate each contact
    contacts.forEach(c => {
      if (!c.name || !c.number) {
        throw new ValidationError("Each contact must have a name and a number");
      }
      // Simple regex for mobile or landline
      if (!/^\+?[\d\s-]{3,15}$/.test(c.number)) {
        throw new ValidationError(`Invalid phone number: ${c.number}`);
      }
    });

    // Use transaction to replace contacts
    return await prisma.$transaction(async (tx) => {
      // Clear existing society-specific contacts
      await tx.emergencyContact.deleteMany({
        where: { societyId }
      });

      // Create new ones
      const created = await Promise.all(
        contacts.map(c => tx.emergencyContact.create({
          data: {
            name: c.name,
            number: c.number,
            type: c.type || 'OTHER',
            societyId
          }
        }))
      );

      // Invalidate cache
      contactsCache.delete(societyId);

      return created;
    });
  },

  /**
   * 3. Get Emergency Instructions
   */
  getEmergencyInstructions(alertType) {
    return EMERGENCY_INSTRUCTIONS[alertType] || EMERGENCY_INSTRUCTIONS.OTHER;
  }
};

module.exports = emergencyContactsService;
