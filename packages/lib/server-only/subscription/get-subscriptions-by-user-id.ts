import { prisma } from '@documenso/prisma';

export type GetSubscriptionsByOrganisationIdOptions = {
  organisationId: string;
};

export const getSubscriptionsByUserId = async ({
  organisationId,
}: GetSubscriptionsByOrganisationIdOptions) => {
  console.log(
    '[GET_SUBSCRIPTIONS_BY_ORGANISATION_ID] Fetching subscriptions for organisation:',
    organisationId,
  );

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organisationId,
    },
  });

  console.log('[GET_SUBSCRIPTIONS_BY_ORGANISATION_ID] Found subscriptions:', subscriptions);
  return subscriptions;
};
