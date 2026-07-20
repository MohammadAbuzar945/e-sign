import {
  OrganisationCreditPurchaseStatus,
  ResellerCreditTransactionStatus,
} from '@prisma/client';

import { getNomiaSubscriptionPlanDetails } from '@documenso/lib/constants/nomia-subscription-plans';
import { prisma } from '@documenso/prisma';

import { getSubscriptionsByUserId } from '../subscription/get-subscriptions-by-user-id';
import { resolveResellerDisplayName } from '../reseller/reseller-association';

export type PurchaseHistoryLineItem = {
  provider: 'nomia' | 'reseller';
  description: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
};

export type PurchaseInvoiceResellerSeller = {
  name: string;
  physicalAddress: string | null;
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  vatNumber: string | null;
  affiliateSlug: string;
  hasLogo: boolean;
};

export type OrganisationPurchaseHistoryItem = {
  invoiceId: string;
  purchaseGroupId: string | null;
  date: Date;
  kind: 'subscription' | 'pay_as_you_go' | 'reseller' | 'hybrid' | 'bulk';
  title: string;
  totalCredits: number;
  totalGrossAmount: number;
  currency: string;
  status: string;
  lineItems: PurchaseHistoryLineItem[];
  /** Present when any line item is fulfilled by a reseller. */
  resellerSeller?: PurchaseInvoiceResellerSeller | null;
};

const HYBRID_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

const formatAmount = (currency: string, amountInCents: number) =>
  `${currency} ${(amountInCents / 100).toFixed(2)}`;

const resolveCombinedStatus = (statuses: string[]) => {
  if (statuses.some((status) => status === 'PENDING')) {
    return 'PENDING';
  }

  if (statuses.every((status) => status === 'COMPLETED' || status === 'ACTIVE')) {
    return 'COMPLETED';
  }

  return statuses[0] ?? 'PENDING';
};

const resolveGroupedPurchaseType = (
  item: OrganisationPurchaseHistoryItem,
): OrganisationPurchaseHistoryItem => {
  const hasNomia = item.lineItems.some((line) => line.provider === 'nomia');
  const hasReseller = item.lineItems.some((line) => line.provider === 'reseller');

  if (hasNomia && hasReseller) {
    return {
      ...item,
      kind: 'hybrid',
      title: 'Split purchase (Reseller + Nomia)',
    };
  }

  if (hasReseller) {
    return {
      ...item,
      kind: 'reseller',
      title: item.lineItems[0]?.description ?? 'Reseller credit purchase',
    };
  }

  return {
    ...item,
    kind: 'pay_as_you_go',
    title: 'Pay as you go top-up (Nomia)',
  };
};

const buildNomiaLineItem = ({
  credits,
  grossAmount,
  currency,
  status,
  reference,
  description,
}: {
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
  description: string;
}): PurchaseHistoryLineItem => ({
  provider: 'nomia',
  description,
  credits,
  grossAmount,
  currency,
  status,
  reference,
});

const buildResellerLineItem = ({
  resellerDisplayName,
  credits,
  grossAmount,
  currency,
  status,
  reference,
}: {
  resellerDisplayName: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
}): PurchaseHistoryLineItem => ({
  provider: 'reseller',
  description: `Credits from ${resellerDisplayName}`,
  credits,
  grossAmount,
  currency,
  status,
  reference,
});

const getResellerPurchaseDisplayName = (profile: {
  organisation: { name: string };
  brandingCompanyDetails: string | null;
}) => resolveResellerDisplayName(profile);

const buildResellerSellerDetails = (profile: {
  organisation: { name: string };
  brandingCompanyDetails: string | null;
  physicalAddress: string | null;
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  vatNumber: string | null;
  affiliateSlug: string;
  brandingEnabled: boolean;
  brandingLogo: string | null;
}): PurchaseInvoiceResellerSeller => ({
  name: getResellerPurchaseDisplayName(profile),
  physicalAddress: profile.physicalAddress,
  vatStatus: profile.vatStatus,
  vatNumber: profile.vatNumber,
  affiliateSlug: profile.affiliateSlug,
  hasLogo: Boolean(profile.brandingEnabled && profile.brandingLogo),
});

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
        package: {
          select: {
            creditAmount: true,
            catalogPackageId: true,
          },
        },
        resellerProfile: {
          select: {
            affiliateSlug: true,
            brandingEnabled: true,
            brandingLogo: true,
            brandingCompanyDetails: true,
            physicalAddress: true,
            vatStatus: true,
            vatNumber: true,
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

  const grouped = new Map<string, OrganisationPurchaseHistoryItem>();
  const consumedNomiaIds = new Set<string>();
  const consumedResellerIds = new Set<string>();

  const addGroupedItem = (item: OrganisationPurchaseHistoryItem) => {
    grouped.set(item.invoiceId, item);
  };

  for (const purchase of payAsYouGoPurchases) {
    if (!purchase.purchaseGroupId) {
      continue;
    }

    const existing = grouped.get(purchase.purchaseGroupId);

    const nomiaLine = buildNomiaLineItem({
      credits: purchase.credits,
      grossAmount: purchase.grossAmount,
      currency: purchase.currency,
      status: purchase.status,
      reference: purchase.paystackReference,
      description: 'Nomia credit top-up',
    });

    if (existing) {
      existing.lineItems.push(nomiaLine);
      existing.totalCredits += purchase.credits;
      existing.totalGrossAmount += purchase.grossAmount;
      existing.date = new Date(
        Math.max(existing.date.getTime(), (purchase.completedAt ?? purchase.createdAt).getTime()),
      );
      existing.status = resolveCombinedStatus(existing.lineItems.map((line) => line.status));
      consumedNomiaIds.add(purchase.id);
      continue;
    }

    grouped.set(purchase.purchaseGroupId, {
      invoiceId: purchase.purchaseGroupId,
      purchaseGroupId: purchase.purchaseGroupId,
      date: purchase.completedAt ?? purchase.createdAt,
      kind: 'hybrid',
      title: 'Split purchase (Reseller + Nomia)',
      totalCredits: purchase.credits,
      totalGrossAmount: purchase.grossAmount,
      currency: purchase.currency,
      status: purchase.status,
      lineItems: [nomiaLine],
    });
    consumedNomiaIds.add(purchase.id);
  }

  for (const transaction of resellerPurchases) {
    if (!transaction.purchaseGroupId) {
      continue;
    }

    const existing = grouped.get(transaction.purchaseGroupId);
    const resellerDisplayName = getResellerPurchaseDisplayName(transaction.resellerProfile);
    const resellerSeller = buildResellerSellerDetails(transaction.resellerProfile);
    const resellerLine = buildResellerLineItem({
      resellerDisplayName,
      credits: transaction.credits,
      grossAmount: transaction.grossAmount,
      currency: transaction.currency,
      status: transaction.status,
      reference: transaction.paystackReference,
    });

    if (existing) {
      existing.lineItems.unshift(resellerLine);
      existing.totalCredits += transaction.credits;
      existing.totalGrossAmount += transaction.grossAmount;
      existing.resellerSeller = existing.resellerSeller ?? resellerSeller;
      existing.date = new Date(
        Math.max(
          existing.date.getTime(),
          (transaction.completedAt ?? transaction.createdAt).getTime(),
        ),
      );
      existing.status = resolveCombinedStatus(existing.lineItems.map((line) => line.status));
      consumedResellerIds.add(transaction.id);
      continue;
    }

    grouped.set(transaction.purchaseGroupId, {
      invoiceId: transaction.purchaseGroupId,
      purchaseGroupId: transaction.purchaseGroupId,
      date: transaction.completedAt ?? transaction.createdAt,
      kind: 'hybrid',
      title: 'Split purchase (Reseller + Nomia)',
      totalCredits: transaction.credits,
      totalGrossAmount: transaction.grossAmount,
      currency: transaction.currency,
      status: transaction.status,
      lineItems: [resellerLine],
      resellerSeller,
    });
    consumedResellerIds.add(transaction.id);
  }

  for (const transaction of resellerPurchases) {
    if (consumedResellerIds.has(transaction.id) || !transaction.package) {
      continue;
    }

    const isPartial =
      transaction.credits > 0 && transaction.credits < transaction.package.creditAmount;

    if (!isPartial) {
      continue;
    }

    const resellerDate = transaction.completedAt ?? transaction.createdAt;
    const expectedNomiaCredits = transaction.package.creditAmount - transaction.credits;

    const matchingNomia = payAsYouGoPurchases.find((purchase) => {
      if (consumedNomiaIds.has(purchase.id) || purchase.purchaseGroupId) {
        return false;
      }

      const purchaseDate = purchase.completedAt ?? purchase.createdAt;
      const withinWindow =
        purchaseDate.getTime() >= resellerDate.getTime() &&
        purchaseDate.getTime() - resellerDate.getTime() <= HYBRID_MATCH_WINDOW_MS;

      return withinWindow && purchase.credits === expectedNomiaCredits;
    });

    if (!matchingNomia) {
      continue;
    }

    const legacyInvoiceId = `hybrid_${transaction.id}_${matchingNomia.id}`;

    addGroupedItem({
      invoiceId: legacyInvoiceId,
      purchaseGroupId: null,
      date: matchingNomia.completedAt ?? matchingNomia.createdAt,
      kind: 'hybrid',
      title: 'Split purchase (Reseller + Nomia)',
      totalCredits: transaction.credits + matchingNomia.credits,
      totalGrossAmount: transaction.grossAmount + matchingNomia.grossAmount,
      currency: transaction.currency,
      status: resolveCombinedStatus([transaction.status, matchingNomia.status]),
      resellerSeller: buildResellerSellerDetails(transaction.resellerProfile),
      lineItems: [
        buildResellerLineItem({
          resellerDisplayName: getResellerPurchaseDisplayName(transaction.resellerProfile),
          credits: transaction.credits,
          grossAmount: transaction.grossAmount,
          currency: transaction.currency,
          status: transaction.status,
          reference: transaction.paystackReference,
        }),
        buildNomiaLineItem({
          credits: matchingNomia.credits,
          grossAmount: matchingNomia.grossAmount,
          currency: matchingNomia.currency,
          status: matchingNomia.status,
          reference: matchingNomia.paystackReference,
          description: 'Nomia credit top-up (remainder)',
        }),
      ],
    });

    consumedResellerIds.add(transaction.id);
    consumedNomiaIds.add(matchingNomia.id);
  }

  const standaloneItems: OrganisationPurchaseHistoryItem[] = [];

  for (const purchase of payAsYouGoPurchases) {
    if (consumedNomiaIds.has(purchase.id)) {
      continue;
    }

    standaloneItems.push({
      invoiceId: `nomia_${purchase.id}`,
      purchaseGroupId: purchase.purchaseGroupId,
      date: purchase.completedAt ?? purchase.createdAt,
      kind: purchase.purchaseType === 'BULK' ? 'bulk' : 'pay_as_you_go',
      title:
        purchase.purchaseType === 'BULK'
          ? 'Bulk inventory top-up'
          : 'Pay as you go top-up',
      totalCredits: purchase.credits,
      totalGrossAmount: purchase.grossAmount,
      currency: purchase.currency,
      status: purchase.status,
      lineItems: [
        buildNomiaLineItem({
          credits: purchase.credits,
          grossAmount: purchase.grossAmount,
          currency: purchase.currency,
          status: purchase.status,
          reference: purchase.paystackReference,
          description:
            purchase.purchaseType === 'BULK'
              ? 'Bulk inventory top-up'
              : 'Pay as you go top-up',
        }),
      ],
    });
  }

  for (const transaction of resellerPurchases) {
    if (consumedResellerIds.has(transaction.id)) {
      continue;
    }

    const resellerDisplayName = getResellerPurchaseDisplayName(transaction.resellerProfile);

    standaloneItems.push({
      invoiceId: `reseller_${transaction.id}`,
      purchaseGroupId: transaction.purchaseGroupId,
      date: transaction.completedAt ?? transaction.createdAt,
      kind: 'reseller',
      title: `Credits from ${resellerDisplayName}`,
      totalCredits: transaction.credits,
      totalGrossAmount: transaction.grossAmount,
      currency: transaction.currency,
      status: transaction.status,
      resellerSeller: buildResellerSellerDetails(transaction.resellerProfile),
      lineItems: [
        buildResellerLineItem({
          resellerDisplayName,
          credits: transaction.credits,
          grossAmount: transaction.grossAmount,
          currency: transaction.currency,
          status: transaction.status,
          reference: transaction.paystackReference,
        }),
      ],
    });
  }

  const subscriptionItems: OrganisationPurchaseHistoryItem[] = subscriptions.map((subscription) => {
    const planCode = subscription.priceId || subscription.planId;
    const planDetails = getNomiaSubscriptionPlanDetails(planCode);
    const credits = planDetails?.credits ?? 0;
    const grossAmount = planDetails?.priceInCents ?? 0;
    const title = planDetails
      ? `${planDetails.label} — ${planDetails.name}`
      : planCode;
    const status = subscription.status === 'PAST_DUE' ? 'INCOMPLETE' : subscription.status;

    return {
      invoiceId: `subscription_${subscription.id}`,
      purchaseGroupId: null,
      date: subscription.updatedAt,
      kind: 'subscription' as const,
      title,
      totalCredits: credits,
      totalGrossAmount: grossAmount,
      currency: 'ZAR',
      status,
      lineItems: [
        {
          provider: 'nomia' as const,
          description: title,
          credits,
          grossAmount,
          currency: 'ZAR',
          status,
          reference: planCode,
        },
      ],
    };
  });

  const groupedItems = [...grouped.values()].map(resolveGroupedPurchaseType);

  return [...subscriptionItems, ...standaloneItems, ...groupedItems].sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  );
};

export { formatAmount };
