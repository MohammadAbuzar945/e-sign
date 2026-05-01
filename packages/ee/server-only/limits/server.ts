import { DocumentSource, EnvelopeType, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { ZClaimFlagsSchema } from '@documenso/lib/types/subscription';
import { getCurrentSubscriptionByOrganisationId } from '@documenso/lib/server-only/subscription/get-current-subscription-by-organisation-id';
import { prisma } from '@documenso/prisma';

import {
  FREE_PLAN_LIMITS,
  INACTIVE_PLAN_LIMITS,
  PAID_PLAN_LIMITS,
  SELFHOSTED_PLAN_LIMITS,
} from './constants';
import { ERROR_CODES } from './errors';
import type { TLimitsResponseSchema } from './schema';
import { ensureOrganisationCredits, getOrganisationCredits } from './user-credits';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async ({
  userId,
  teamId,
}: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  // console.log('userId', userId);
  // console.log('teamId', teamId);
  // console.log('prisma type:', typeof prisma);
  // console.log('prisma value:', prisma);
  // console.log('prisma.team type:', typeof prisma?.team);

  // if (!prisma) {
  //   console.error('Prisma client is undefined. Check if @documenso/prisma is properly imported.');
  //   throw new Error('Database connection failed');
  // }

  // if (!prisma.team) {
  //   console.error('Prisma team model is undefined. Prisma object:', Object.keys(prisma || {}));
  //   throw new Error('Database connection failed - team model not available');
  // }

  // Debug: Check if team exists and what organisation it belongs to
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, organisationId: true, name: true },
  });

  if (!team) {
    console.error('Team not found:', teamId);
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  console.log('Team found:', team);

  // Debug: Check if user is a member of any organisation
  const userOrganisationMembers = await prisma.organisationMember.findMany({
    where: { userId },
    select: { organisationId: true, organisation: { select: { id: true, name: true } } },
  });

  console.log('User organisation members:', userOrganisationMembers);

  // Check if the team's organisation matches any of the user's organisations
  const userOrganisationIds = userOrganisationMembers.map((m) => m.organisationId);
  if (!userOrganisationIds.includes(team.organisationId)) {
    console.error(
      'User is not a member of the team\'s organisation. Team organisationId:',
      team.organisationId,
      'User organisationIds:',
      userOrganisationIds,
    );
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      id: team.organisationId,
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationClaim: true,
    },
  });

  if (!organisation) {
    console.error('No organisation found for userId:', userId, 'teamId:', teamId, 'organisationId:', team.organisationId);
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  if (!organisation.organisationClaim) {
    console.error('Organisation found but missing organisationClaim. Organisation ID:', organisation.id);
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const claimFlags = ZClaimFlagsSchema.parse(organisation.organisationClaim.flags);

  const subscription = await getCurrentSubscriptionByOrganisationId({
    organisationId: organisation.id,
  });
  
  // Query organisation credits from UserCredits table (credits column)
  // Each organisation has its own credits pool
  let userCredits: number;
  try {
    userCredits = await getOrganisationCredits(organisation.id);
  } catch (err) {
    console.error('Error fetching organisation credits:', err);
    // Log the actual error for debugging
    if (err instanceof Error) {
      console.error('Error details:', err.message, err.stack);
      // If it's a Prisma error about table not existing, provide helpful message
      if (err.message.includes('does not exist') || err.message.includes('Unknown model')) {
        throw new Error('UserCredits table does not exist. Please run migrations: npm run prisma:migrate-dev');
      }
    }
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }
  
  // Get maximumEnvelopeItemCount from organisationClaim
  const maximumEnvelopeItemCount = organisation.organisationClaim.envelopeItemCount;
  
  // Validate that envelopeItemCount was successfully queried from database
  // Allow 0 as a valid value
  if (typeof maximumEnvelopeItemCount !== 'number' || isNaN(maximumEnvelopeItemCount) || maximumEnvelopeItemCount < 0) {
    console.error('Invalid envelopeItemCount value:', maximumEnvelopeItemCount);
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  // Set quota and remaining from user credits
  // Always use user credits for documents quota and remaining
  const quota = {
    documents: userCredits, // Initial credits from UserCredits table (10)
    recipients: FREE_PLAN_LIMITS.recipients,
    directTemplates: FREE_PLAN_LIMITS.directTemplates,
  };
  
  const remaining = {
    documents: Math.max(userCredits, 0), // Current remaining credits from UserCredits table
    recipients: FREE_PLAN_LIMITS.recipients,
    directTemplates: FREE_PLAN_LIMITS.directTemplates,
  };

  if (!IS_BILLING_ENABLED()) {
    return {
      quota: {
        ...quota,
        recipients: SELFHOSTED_PLAN_LIMITS.recipients,
        directTemplates: SELFHOSTED_PLAN_LIMITS.directTemplates,
      },
      remaining: {
        ...remaining,
        recipients: SELFHOSTED_PLAN_LIMITS.recipients,
        directTemplates: SELFHOSTED_PLAN_LIMITS.directTemplates,
      },
      maximumEnvelopeItemCount,
    };
  }

  // Bypass all limits even if plan expired for ENTERPRISE.
  if (organisation.organisationClaimId === INTERNAL_CLAIM_ID.ENTERPRISE) {
    return {
      quota: {
        ...quota,
        recipients: PAID_PLAN_LIMITS.recipients,
        directTemplates: PAID_PLAN_LIMITS.directTemplates,
      },
      remaining: {
        ...remaining,
        recipients: PAID_PLAN_LIMITS.recipients,
        directTemplates: PAID_PLAN_LIMITS.directTemplates,
      },
      maximumEnvelopeItemCount,
    };
  }

  // Early return for users with an expired subscription.
  if (subscription && subscription.status === SubscriptionStatus.INACTIVE) {
    return {
      quota: {
        ...quota,
        recipients: INACTIVE_PLAN_LIMITS.recipients,
        directTemplates: INACTIVE_PLAN_LIMITS.directTemplates,
      },
      remaining: {
        ...remaining,
        recipients: INACTIVE_PLAN_LIMITS.recipients,
        directTemplates: INACTIVE_PLAN_LIMITS.directTemplates,
      },
      maximumEnvelopeItemCount,
    };
  }

  // Allow unlimited documents for users with an unlimited documents claim.
  // This also allows "free" claim users without subscriptions if they have this flag.
  if (claimFlags.unlimitedDocuments) {
    return {
      quota: {
        ...quota,
        recipients: PAID_PLAN_LIMITS.recipients,
        directTemplates: PAID_PLAN_LIMITS.directTemplates,
      },
      remaining: {
        ...remaining,
        recipients: PAID_PLAN_LIMITS.recipients,
        directTemplates: PAID_PLAN_LIMITS.directTemplates,
      },
      maximumEnvelopeItemCount,
    };
  }

  // Still count direct templates the old way for now
  const directTemplates = await prisma.envelope.count({
    where: {
      type: EnvelopeType.TEMPLATE,
      team: {
        organisationId: organisation.id,
      },
      directLink: {
        isNot: null,
      },
    },
  });

  remaining.directTemplates = Math.max(remaining.directTemplates - directTemplates, 0);

  // Ensure quota and remaining documents are always set from user credits
  quota.documents = userCredits;
  remaining.documents = Math.max(userCredits, 0);

  return {
    quota,
    remaining,
    maximumEnvelopeItemCount,
  };
};
