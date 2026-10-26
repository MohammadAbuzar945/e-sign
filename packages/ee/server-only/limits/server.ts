import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { organisationAllowsNegativeCredits } from '@documenso/lib/server-only/reseller/organisation-allows-negative-credits';
import { getCurrentSubscriptionByOrganisationId } from '@documenso/lib/server-only/subscription/get-current-subscription-by-organisation-id';
import { INTERNAL_CLAIM_ID, ZClaimFlagsSchema } from '@documenso/lib/types/subscription';
import { isOrganisationPendingPayment } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, SubscriptionStatus } from '@prisma/client';

import {
  FREE_PLAN_LIMITS,
  INACTIVE_PLAN_LIMITS,
  PAID_PLAN_LIMITS,
  SELFHOSTED_PLAN_LIMITS,
} from './constants';
import { ERROR_CODES } from './errors';
import type { TLimitsResponseSchema } from './schema';
import { getOrganisationCredits } from './user-credits';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async ({
  userId,
  teamId,
}: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      teams: {
        some: {
          id: teamId,
        },
      },
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
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  if (!organisation.organisationClaim) {
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const claimFlags = ZClaimFlagsSchema.parse(organisation.organisationClaim.flags);

  const subscription = await getCurrentSubscriptionByOrganisationId({
    organisationId: organisation.id,
  });

  // Query organisation credits from UserCredits table (credits column).
  // Each organisation has its own credits pool.
  let userCredits: number;
  try {
    userCredits = await getOrganisationCredits(organisation.id);
  } catch (err) {
    console.error('Error fetching organisation credits:', err);
    if (err instanceof Error) {
      if (err.message.includes('does not exist') || err.message.includes('Unknown model')) {
        throw new Error(
          'UserCredits table does not exist. Please run migrations: npm run prisma:migrate-dev',
        );
      }
    }
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const maximumEnvelopeItemCount = organisation.organisationClaim.envelopeItemCount;

  if (
    typeof maximumEnvelopeItemCount !== 'number' ||
    isNaN(maximumEnvelopeItemCount) ||
    maximumEnvelopeItemCount < 0
  ) {
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const allowNegativeCredits = await organisationAllowsNegativeCredits(organisation.id);
  const remainingDocuments = allowNegativeCredits ? userCredits : Math.max(userCredits, 0);

  const quota = {
    documents: userCredits,
    recipients: FREE_PLAN_LIMITS.recipients,
    directTemplates: FREE_PLAN_LIMITS.directTemplates,
  };

  const remaining = {
    documents: remainingDocuments,
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
      allowNegativeCredits,
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
      allowNegativeCredits,
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
      allowNegativeCredits,
    };
  }

  // Early return for organisations created ahead of a paid checkout that are still awaiting payment.
  if (isOrganisationPendingPayment(organisation)) {
    return {
      quota: INACTIVE_PLAN_LIMITS,
      remaining: INACTIVE_PLAN_LIMITS,
      maximumEnvelopeItemCount,
      allowNegativeCredits,
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
      allowNegativeCredits,
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

  quota.documents = userCredits;
  remaining.documents = remainingDocuments;

  return {
    quota,
    remaining,
    maximumEnvelopeItemCount,
    allowNegativeCredits,
  };
};
