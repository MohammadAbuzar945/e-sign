import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetCurrentSubscriptionByOrganisationIdOptions = {
  organisationId: string;
};

export const getCurrentSubscriptionByOrganisationId = async ({
  organisationId,
}: GetCurrentSubscriptionByOrganisationIdOptions) => {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      organisationId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (activeSubscription) {
    return activeSubscription;
  }

  return await prisma.subscription.findFirst({
    where: {
      organisationId,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
};

