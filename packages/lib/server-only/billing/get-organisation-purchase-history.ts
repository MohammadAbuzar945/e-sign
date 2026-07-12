import {
  OrganisationCreditPurchaseStatus,
  ResellerCreditTransactionStatus,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getSubscriptionsByUserId } from '../subscription/get-subscriptions-by-user-id';

export type NomiaSubscriptionPurchaseHistoryItem = {
  id: string;
  source: 'nomia';
  kind: 'subscription';
  date: Date;
  planCode: string;
  status: string;
  reference: string | null;
};

export type NomiaPayAsYouGoPurchaseHistoryItem = {
  id: string;
  source: 'nomia';
  kind: 'pay_as_you_go';
  date: Date;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
};

export type NomiaPurchaseHistoryItem =
  | NomiaSubscriptionPurchaseHistoryItem
  | NomiaPayAsYouGoPurchaseHistoryItem;

export type ResellerPurchaseHistoryItem = {
  id: string;
  source: 'reseller';
  date: Date;
  resellerOrganisationName: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
};

export type OrganisationPurchaseHistoryItem =
  | NomiaPurchaseHistoryItem
  | ResellerPurchaseHistoryItem;

export const getOrganisationPurchaseHistory = async ({
  organisationId,
}: {
  organisationId: string;
}): Promise<OrganisationPurchaseHistoryItem[]> => {
  const [subscriptions, payAsYouGoPurchases, resellerPurchases] = await Promise.all([
    getSubscriptionsByUserId({ organisationId }),
    prisma.organisationCreditPurchase.findMany({
      where: {
        organisationId,
        status: {
          in: [
            OrganisationCreditPurchaseStatus.COMPLETED,
            OrganisationCreditPurchaseStatus.PENDING,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.resellerCreditTransaction.findMany({
      where: {
        purchaserOrganisationId: organisationId,
        status: {
          in: [
            ResellerCreditTransactionStatus.COMPLETED,
            ResellerCreditTransactionStatus.PENDING,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        resellerProfile: {
          include: {
            organisation: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const subscriptionItems: NomiaSubscriptionPurchaseHistoryItem[] = subscriptions.map(
    (subscription) => ({
      id: `subscription-${subscription.id}`,
      source: 'nomia',
      kind: 'subscription',
      date: subscription.updatedAt,
      planCode: subscription.priceId || subscription.planId,
      status: subscription.status === 'PAST_DUE' ? 'INCOMPLETE' : subscription.status,
      reference: subscription.planId,
    }),
  );

  const payAsYouGoItems: NomiaPayAsYouGoPurchaseHistoryItem[] = payAsYouGoPurchases.map(
    (purchase) => ({
      id: purchase.id,
      source: 'nomia',
      kind: 'pay_as_you_go',
      date: purchase.completedAt ?? purchase.createdAt,
      credits: purchase.credits,
      grossAmount: purchase.grossAmount,
      currency: purchase.currency,
      status: purchase.status,
      reference: purchase.paystackReference,
    }),
  );

  const resellerItems: ResellerPurchaseHistoryItem[] = resellerPurchases.map((transaction) => ({
    id: transaction.id,
    source: 'reseller',
    date: transaction.completedAt ?? transaction.createdAt,
    resellerOrganisationName: transaction.resellerProfile.organisation.name,
    credits: transaction.credits,
    grossAmount: transaction.grossAmount,
    currency: transaction.currency,
    status: transaction.status,
    reference: transaction.paystackReference,
  }));

  return [...subscriptionItems, ...payAsYouGoItems, ...resellerItems].sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  );
};
