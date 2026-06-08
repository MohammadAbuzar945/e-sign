import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@prisma/client';

export type GetActiveSubscriptionsByOrganisationIdOptions = {
  organisationId: string;
};

export const getActiveSubscriptionsByUserId = async ({
  organisationId,
}: GetActiveSubscriptionsByOrganisationIdOptions) => {
  return await prisma.subscription.findMany({
    where: {
      organisationId,
      status: {
        not: SubscriptionStatus.INACTIVE,
      },
    },
  });
};
