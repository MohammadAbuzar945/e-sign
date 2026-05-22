import { prisma } from '@documenso/prisma';
import type { UserCredits } from '@prisma/client';
export const INITIAL_USER_CREDITS = 10;

/**
 * Ensures an organisation has a UserCredits record, creating one if it doesn't exist.
 * Returns the organisation's credits record.
 */
export const ensureOrganisationCredits = async (organisationId: string, userId: number) => {
  if (!prisma) {
    console.error('Prisma client is undefined in ensureOrganisationCredits. Check if @documenso/prisma is properly imported.');
    throw new Error('Database connection failed');
  }

  if (!prisma.userCredits) {
    console.error('Prisma userCredits model is undefined. Prisma object:', Object.keys(prisma || {}));
    throw new Error('Database connection failed - userCredits model not available');
  }

  // Find the active credits record for this organisation
  let userCredits = await prisma.userCredits.findFirst({
    where: {
      organisationId,
      isActive: true,
    },
  });

  if (!userCredits) {
    // Create a user credit record with 0 credits for this organisation
    userCredits = await prisma.userCredits.create({
      data: {
        userId,
        organisationId,
        credits: 0,
        isActive: true,
      },
    });
  }

  // Check if credits have expired
  if (userCredits.expiresAt && userCredits.expiresAt < new Date()) {
    // Reset credits if expired
    userCredits = await prisma.userCredits.update({
      where: {
        id: userCredits.id,
      },
      data: {
        credits: 0,
        expiresAt: null,
        isActive: true,
      },
    });
  }

  return userCredits;
};

/**
 * Deducts credits from an organisation's account.
 * Returns the updated credits record.
 */
export const deductOrganisationCredits = async (organisationId: string, amount: number = 1) => {
  // Get organisation to find the owner userId
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { ownerUserId: true },
  });

  if (!organisation) {
    throw new Error(`Organisation with id ${organisationId} not found`);
  }

  const userCredits = await ensureOrganisationCredits(organisationId, organisation.ownerUserId);

  const updatedCredits = await prisma.userCredits.update({
    where: {
      id: userCredits.id,
    },
    data: {
      credits: Math.max(userCredits.credits - amount, 0),
    },
  });

  return updatedCredits;
};

/**
 * Updates the credits balance for an organisation (admin use).
 * Ensures a UserCredits record exists, then sets credits to the given value.
 */
export const updateOrganisationCredits = async (organisationId: string, credits: number) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { ownerUserId: true },
  });

  if (!organisation) {
    throw new Error(`Organisation with id ${organisationId} not found`);
  }

  const userCredits = await ensureOrganisationCredits(organisationId, organisation.ownerUserId);

  const updated = await prisma.userCredits.update({
    where: { id: userCredits.id },
    data: {
      credits: Math.max(0, Math.floor(credits)),
      lastUpdatedAt: new Date(),
    },
  });

  return updated;
};

/**
 * Gets the current credits for an organisation.
 */
export const getOrganisationCredits = async (organisationId: string) => {
  if (!prisma) {
    console.error('Prisma client is undefined in getOrganisationCredits. Check if @documenso/prisma is properly imported.');
    throw new Error('Database connection failed');
  }

  try {
    // Get organisation to find the owner userId
    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { ownerUserId: true },
    });

    if (!organisation) {
      throw new Error(`Organisation with id ${organisationId} not found`);
    }

    const userCredits = await ensureOrganisationCredits(organisationId, organisation.ownerUserId);
    return userCredits.credits;
  } catch (err) {
    console.error('Error in getOrganisationCredits for organisationId:', organisationId, 'error:', err);
    // If table doesn't exist or other Prisma error, return default
    if (err instanceof Error && err.message.includes('does not exist')) {
      throw new Error('UserCredits table does not exist. Please run migrations.');
    }
    throw err;
  }
};

/**
 * @deprecated Use ensureOrganisationCredits instead. This function is kept for backwards compatibility.
 * Ensures a user has a UserCredits record, creating one if it doesn't exist.
 * Returns the user's credits record.
 */
export const ensureUserCredits = async (userId: number) => {
  // Find user's personal organisation
  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: userId,
      type: 'PERSONAL',
    },
  });

  if (!organisation) {
    throw new Error(`Personal organisation not found for user ${userId}`);
  }

  return ensureOrganisationCredits(organisation.id, userId);
};

/**
 * @deprecated Use deductOrganisationCredits instead. This function is kept for backwards compatibility.
 * Deducts credits from a user's account.
 * Returns the updated credits record.
 */
export const deductUserCredits = async (userId: number, amount: number = 1) => {
  // Find user's personal organisation
  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: userId,
      type: 'PERSONAL',
    },
  });

  if (!organisation) {
    throw new Error(`Personal organisation not found for user ${userId}`);
  }

  return deductOrganisationCredits(organisation.id, amount);
};

/**
 * @deprecated Use getOrganisationCredits instead. This function is kept for backwards compatibility.
 * Gets the current credits for a user.
 */
export const getUserCredits = async (userId: number) => {
  // Find user's personal organisation
  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: userId,
      type: 'PERSONAL',
    },
  });

  if (!organisation) {
    throw new Error(`Personal organisation not found for user ${userId}`);
  }

  return getOrganisationCredits(organisation.id);
};
