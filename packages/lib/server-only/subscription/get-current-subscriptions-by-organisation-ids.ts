import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetCurrentSubscriptionsByOrganisationIdsOptions = {
  organisationIds: string[];
};

export const getCurrentSubscriptionsByOrganisationIds = async ({
  organisationIds,
}: GetCurrentSubscriptionsByOrganisationIdsOptions) => {
  if (organisationIds.length === 0) {
    return {} as Record<string, null>;
  }

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organisationId: {
        in: organisationIds,
      },
    },
    orderBy: [
      {
        organisationId: 'asc',
      },
      {
        updatedAt: 'desc',
      },
    ],
  });

  const activeStatuses = new Set<SubscriptionStatus>([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
  ]);

  const bestByOrganisationId = new Map<
    string,
    {
      latest: (typeof subscriptions)[number] | null;
      active: (typeof subscriptions)[number] | null;
    }
  >();

  for (const subscription of subscriptions) {
    const existing = bestByOrganisationId.get(subscription.organisationId) ?? {
      latest: null,
      active: null,
    };

    if (!existing.latest) {
      existing.latest = subscription;
    }

    if (!existing.active && activeStatuses.has(subscription.status)) {
      existing.active = subscription;
    }

    bestByOrganisationId.set(subscription.organisationId, existing);
  }

  const result: Record<string, (typeof subscriptions)[number] | null> = {};

  for (const organisationId of organisationIds) {
    const entry = bestByOrganisationId.get(organisationId);
    result[organisationId] = entry?.active ?? entry?.latest ?? null;
  }

  return result;
};

