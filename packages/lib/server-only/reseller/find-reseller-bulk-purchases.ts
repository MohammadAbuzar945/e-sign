import {
  OrganisationCreditPurchaseStatus,
  Prisma,
  ResellerCreditTransactionStatus,
  SubscriptionStatus,
} from '@prisma/client';

import { getNomiaSubscriptionPlanDetails } from '@documenso/lib/constants/nomia-subscription-plans';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

export type AdminPurchaseInvoiceKind = 'BULK' | 'PAYG' | 'RESELLER' | 'SUBSCRIPTION';

export type AdminPurchaseInvoiceStatus =
  | OrganisationCreditPurchaseStatus
  | 'REFUNDED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PAST_DUE';

export type FindAdminPurchaseInvoicesOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: AdminPurchaseInvoiceStatus;
  kind?: AdminPurchaseInvoiceKind | 'ALL';
};

const mapResellerStatus = (
  status: ResellerCreditTransactionStatus,
): AdminPurchaseInvoiceStatus => {
  if (status === ResellerCreditTransactionStatus.REFUNDED) {
    return 'REFUNDED';
  }

  if (status === ResellerCreditTransactionStatus.FAILED) {
    return 'FAILED';
  }

  if (status === ResellerCreditTransactionStatus.COMPLETED) {
    return 'COMPLETED';
  }

  return 'PENDING';
};

const mapSubscriptionLedgerStatus = (
  status: SubscriptionStatus,
): AdminPurchaseInvoiceStatus => {
  if (status === SubscriptionStatus.ACTIVE) {
    return 'ACTIVE';
  }

  if (status === SubscriptionStatus.PAST_DUE) {
    return 'PAST_DUE';
  }

  return 'INACTIVE';
};

/**
 * Admin purchase/invoice ledger:
 * Nomia PAYG + bulk inventory + reseller client sales + subscriptions.
 */
export const findResellerBulkPurchases = async ({
  query = '',
  page = 1,
  perPage = 20,
  status,
  kind = 'ALL',
}: FindAdminPurchaseInvoicesOptions) => {
  const trimmedQuery = query.trim();
  const safePage = Math.max(page, 1);
  const safePerPage = Math.max(perPage, 1);
  const windowSize = safePage * safePerPage;

  const isSubscriptionOnlyStatus =
    status === 'ACTIVE' || status === 'INACTIVE' || status === 'PAST_DUE';
  const isPurchaseOnlyStatus =
    status === 'COMPLETED' ||
    status === 'PENDING' ||
    status === 'FAILED' ||
    status === 'REFUNDED';

  const includeNomia =
    (kind === 'ALL' || kind === 'BULK' || kind === 'PAYG') &&
    status !== 'REFUNDED' &&
    !isSubscriptionOnlyStatus;
  const includeReseller =
    (kind === 'ALL' || kind === 'RESELLER') && !isSubscriptionOnlyStatus;
  const includeSubscriptions =
    (kind === 'ALL' || kind === 'SUBSCRIPTION') &&
    status !== 'REFUNDED' &&
    !isPurchaseOnlyStatus;

  const nomiaPurchaseType =
    kind === 'BULK' ? ('BULK' as const) : kind === 'PAYG' ? ('PAYG' as const) : undefined;

  const nomiaWhere: Prisma.OrganisationCreditPurchaseWhereInput = {
    ...(nomiaPurchaseType ? { purchaseType: nomiaPurchaseType } : {}),
    ...(status && status !== 'REFUNDED' && !isSubscriptionOnlyStatus
      ? { status: status as OrganisationCreditPurchaseStatus }
      : {}),
  };

  const resellerStatusFilter =
    status === 'COMPLETED'
      ? ResellerCreditTransactionStatus.COMPLETED
      : status === 'PENDING'
        ? ResellerCreditTransactionStatus.PENDING
        : status === 'FAILED'
          ? ResellerCreditTransactionStatus.FAILED
          : status === 'REFUNDED'
            ? ResellerCreditTransactionStatus.REFUNDED
            : undefined;

  const resellerWhere: Prisma.ResellerCreditTransactionWhereInput = {
    ...(resellerStatusFilter ? { status: resellerStatusFilter } : {}),
  };

  const subscriptionWhere: Prisma.SubscriptionWhereInput = {
    ...(status === 'ACTIVE' || status === 'INACTIVE' || status === 'PAST_DUE'
      ? { status }
      : {}),
  };

  if (trimmedQuery) {
    nomiaWhere.OR = [
      { paystackReference: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { id: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      {
        organisation: {
          name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        organisation: {
          url: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        user: {
          email: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        user: {
          name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
    ];

    resellerWhere.OR = [
      { paystackReference: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { id: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { purchaserName: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { purchaserEmail: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      {
        purchaserOrganisationName: {
          contains: trimmedQuery,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        resellerProfile: {
          organisation: {
            name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
          },
        },
      },
      {
        resellerProfile: {
          affiliateSlug: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
    ];

    subscriptionWhere.OR = [
      { planId: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { priceId: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      { customerId: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      {
        organisation: {
          name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        organisation: {
          url: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        organisation: {
          owner: {
            email: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
          },
        },
      },
      {
        organisation: {
          owner: {
            name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
          },
        },
      },
    ];
  }

  const [nomiaRows, resellerRows, subscriptionRows, nomiaCount, resellerCount, subscriptionCount] =
    await Promise.all([
      includeNomia
        ? prisma.organisationCreditPurchase.findMany({
            where: nomiaWhere,
            take: windowSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              completedAt: true,
              status: true,
              credits: true,
              grossAmount: true,
              currency: true,
              paystackReference: true,
              purchaseType: true,
              organisation: {
                select: {
                  id: true,
                  name: true,
                  url: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      includeReseller
        ? prisma.resellerCreditTransaction.findMany({
            where: resellerWhere,
            take: windowSize,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              completedAt: true,
              status: true,
              credits: true,
              grossAmount: true,
              currency: true,
              paystackReference: true,
              purchaserName: true,
              purchaserEmail: true,
              purchaserOrganisationId: true,
              purchaserOrganisationName: true,
              purchaserUserId: true,
              resellerProfile: {
                select: {
                  affiliateSlug: true,
                  organisation: {
                    select: {
                      id: true,
                      name: true,
                      url: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      includeSubscriptions
        ? prisma.subscription.findMany({
            where: subscriptionWhere,
            take: windowSize,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              planId: true,
              priceId: true,
              organisation: {
                select: {
                  id: true,
                  name: true,
                  url: true,
                  owner: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      includeNomia
        ? prisma.organisationCreditPurchase.count({ where: nomiaWhere })
        : Promise.resolve(0),
      includeReseller
        ? prisma.resellerCreditTransaction.count({ where: resellerWhere })
        : Promise.resolve(0),
      includeSubscriptions
        ? prisma.subscription.count({ where: subscriptionWhere })
        : Promise.resolve(0),
    ]);

  const nomiaMapped = nomiaRows.map((row) => ({
    id: row.id,
    invoiceId: `nomia_${row.id}`,
    kind: (row.purchaseType === 'BULK' ? 'BULK' : 'PAYG') as AdminPurchaseInvoiceKind,
    issuer: 'NOMIA' as const,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    status: row.status as AdminPurchaseInvoiceStatus,
    credits: row.credits,
    grossAmount: row.grossAmount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    pricePerCreditCents: row.credits > 0 ? Math.round(row.grossAmount / row.credits) : 0,
    organisation: row.organisation,
    user: row.user,
    resellerName: null as string | null,
    resellerAffiliateSlug: null as string | null,
    title: null as string | null,
  }));

  const resellerMapped = resellerRows.map((row) => ({
    id: row.id,
    invoiceId: `reseller_${row.id}`,
    kind: 'RESELLER' as const,
    issuer: 'RESELLER' as const,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    status: mapResellerStatus(row.status),
    credits: row.credits,
    grossAmount: row.grossAmount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    pricePerCreditCents: row.credits > 0 ? Math.round(row.grossAmount / row.credits) : 0,
    organisation: {
      id: row.purchaserOrganisationId,
      name: row.purchaserOrganisationName,
      url: '',
    },
    user: {
      id: row.purchaserUserId,
      name: row.purchaserName,
      email: row.purchaserEmail,
    },
    resellerName: row.resellerProfile.organisation.name,
    resellerAffiliateSlug: row.resellerProfile.affiliateSlug,
    title: null as string | null,
  }));

  const subscriptionMapped = subscriptionRows.map((row) => {
    const planCode = row.priceId || row.planId;
    const planDetails = getNomiaSubscriptionPlanDetails(planCode);
    const credits = planDetails?.credits ?? 0;
    const grossAmount = planDetails?.priceInCents ?? 0;
    const title = planDetails ? `${planDetails.label} — ${planDetails.name}` : planCode;

    return {
      id: String(row.id),
      invoiceId: `subscription_${row.id}`,
      kind: 'SUBSCRIPTION' as const,
      issuer: 'NOMIA' as const,
      createdAt: row.createdAt,
      completedAt: row.updatedAt,
      status: mapSubscriptionLedgerStatus(row.status),
      credits,
      grossAmount,
      currency: 'ZAR',
      paystackReference: planCode,
      pricePerCreditCents: credits > 0 ? Math.round(grossAmount / credits) : 0,
      organisation: {
        id: row.organisation.id,
        name: row.organisation.name,
        url: row.organisation.url,
      },
      user: {
        id: row.organisation.owner.id,
        name: row.organisation.owner.name,
        email: row.organisation.owner.email,
      },
      resellerName: null as string | null,
      resellerAffiliateSlug: null as string | null,
      title,
    };
  });

  const merged = [...nomiaMapped, ...resellerMapped, ...subscriptionMapped].sort((a, b) => {
    const aTime = (a.completedAt ?? a.createdAt).getTime();
    const bTime = (b.completedAt ?? b.createdAt).getTime();

    return bTime - aTime;
  });

  const skip = (safePage - 1) * safePerPage;
  const data = merged.slice(skip, skip + safePerPage);
  const count = nomiaCount + resellerCount + subscriptionCount;

  return {
    data,
    count,
    currentPage: safePage,
    perPage: safePerPage,
    totalPages: Math.max(1, Math.ceil(count / safePerPage)),
  } satisfies FindResultResponse<typeof data>;
};
