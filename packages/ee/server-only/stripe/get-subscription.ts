import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getCurrentSubscriptionByOrganisationId } from '@documenso/lib/server-only/subscription/get-current-subscription-by-organisation-id';
import { stripe } from '@documenso/lib/server-only/stripe';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

export type GetSubscriptionOptions = {
  userId: number;
  organisationId: string;
};

export const getSubscription = async ({ organisationId, userId }: GetSubscriptionOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const currentSubscription = await getCurrentSubscriptionByOrganisationId({
    organisationId: organisation.id,
  });

  if (!currentSubscription) {
    return null;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.planId, {
    expand: ['items.data.price.product'],
  });

  return {
    organisationSubscription: currentSubscription,
    stripeSubscription,
  };
};
