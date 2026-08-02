import {
  OrganisationCreditPurchaseStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';

import {
  findNomiaSubscriptionPlanForChargeFromCatalog,
  getNomiaSubscriptionPlanDetailsFromCatalog,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { formatNomiaSubscriptionPlanTitle } from '@documenso/lib/constants/nomia-subscription-plans';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

import { resolveNomiaPurchaseInvoiceId } from '../billing/record-organisation-credit-purchase';

export type AdminPurchaseInvoiceKind = 'BULK' | 'PAYG' | 'SUBSCRIPTION';

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

export const ADMIN_PURCHASE_INVOICE_EXPORT_LIMIT = 10_000;

export type ExportCompletedAdminPurchaseInvoicesOptions = {
  query?: string;
  kind?: AdminPurchaseInvoiceKind | 'ALL';
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

const mapNomiaPurchaseKind = (
  purchaseType: 'PAYG' | 'BULK' | 'SUBSCRIPTION',
): AdminPurchaseInvoiceKind => {
  if (purchaseType === 'BULK') {
    return 'BULK';
  }

  if (purchaseType === 'SUBSCRIPTION') {
    return 'SUBSCRIPTION';
  }

  return 'PAYG';
};

const resolveNomiaPurchaseTitle = async ({
  purchaseType,
  credits,
  grossAmount,
}: {
  purchaseType: 'PAYG' | 'BULK' | 'SUBSCRIPTION';
  credits: number;
  grossAmount: number;
}) => {
  if (purchaseType !== 'SUBSCRIPTION') {
    return null;
  }

  return formatNomiaSubscriptionPlanTitle(
    await findNomiaSubscriptionPlanForChargeFromCatalog({
      credits,
      priceInCents: grossAmount,
    }),
  );
};

const buildNomiaPurchaseSearchOr = (
  trimmedQuery: string,
): Prisma.OrganisationCreditPurchaseWhereInput['OR'] => {
  if (!trimmedQuery) {
    return undefined;
  }

  return [
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
};

/**
 * Admin Nomia purchase/invoice ledger only:
 * PAYG top-ups, bulk inventory, and per-charge subscriptions.
 * ACTIVE / INACTIVE / PAST_DUE still surface live Subscription rows.
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

  const includeNomia =
    (kind === 'ALL' || kind === 'BULK' || kind === 'PAYG' || kind === 'SUBSCRIPTION') &&
    status !== 'REFUNDED' &&
    !isSubscriptionOnlyStatus;
  // Live subscription lifecycle rows only when filtering by ACTIVE/INACTIVE/PAST_DUE.
  const includeSubscriptions =
    isSubscriptionOnlyStatus && (kind === 'ALL' || kind === 'SUBSCRIPTION');

  const nomiaPurchaseType =
    kind === 'BULK'
      ? ('BULK' as const)
      : kind === 'PAYG'
        ? ('PAYG' as const)
        : kind === 'SUBSCRIPTION'
          ? ('SUBSCRIPTION' as const)
          : undefined;

  const nomiaWhere: Prisma.OrganisationCreditPurchaseWhereInput = {
    ...(nomiaPurchaseType ? { purchaseType: nomiaPurchaseType } : {}),
    ...(status && status !== 'REFUNDED' && !isSubscriptionOnlyStatus
      ? { status: status as OrganisationCreditPurchaseStatus }
      : {}),
  };

  const subscriptionWhere: Prisma.SubscriptionWhereInput = {
    ...(status === 'ACTIVE' || status === 'INACTIVE' || status === 'PAST_DUE'
      ? { status }
      : {}),
  };

  if (trimmedQuery) {
    nomiaWhere.OR = buildNomiaPurchaseSearchOr(trimmedQuery);

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

  const [nomiaRows, subscriptionRows, nomiaCount, subscriptionCount] = await Promise.all([
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
    includeSubscriptions
      ? prisma.subscription.count({ where: subscriptionWhere })
      : Promise.resolve(0),
  ]);

  const nomiaMapped = await Promise.all(
    nomiaRows.map(async (row) => ({
      id: row.id,
      invoiceId: resolveNomiaPurchaseInvoiceId({ purchaseId: row.id }),
      kind: mapNomiaPurchaseKind(row.purchaseType),
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
      title: await resolveNomiaPurchaseTitle({
        purchaseType: row.purchaseType,
        credits: row.credits,
        grossAmount: row.grossAmount,
      }),
    })),
  );

  const subscriptionMapped = await Promise.all(
    subscriptionRows.map(async (row) => {
      const planCode = row.priceId || row.planId;
      const planDetails = await getNomiaSubscriptionPlanDetailsFromCatalog(planCode);
      const credits = planDetails?.credits ?? 0;
      const grossAmount = planDetails?.priceInCents ?? 0;
      const title = formatNomiaSubscriptionPlanTitle(planDetails, planCode);

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
    }),
  );

  const merged = [...nomiaMapped, ...subscriptionMapped].sort((a, b) => {
    const aTime = (a.completedAt ?? a.createdAt).getTime();
    const bTime = (b.completedAt ?? b.createdAt).getTime();

    return bTime - aTime;
  });

  const skip = (safePage - 1) * safePerPage;
  const data = merged.slice(skip, skip + safePerPage);
  const count = nomiaCount + subscriptionCount;

  return {
    data,
    count,
    currentPage: safePage,
    perPage: safePerPage,
    totalPages: Math.max(1, Math.ceil(count / safePerPage)),
  } satisfies FindResultResponse<typeof data>;
};

/**
 * Export completed Nomia PAYG/bulk/subscription charge invoices.
 */
export const exportCompletedAdminPurchaseInvoices = async ({
  query = '',
  kind = 'ALL',
}: ExportCompletedAdminPurchaseInvoicesOptions) => {
  const trimmedQuery = query.trim();
  const includeNomia = kind === 'ALL' || kind === 'BULK' || kind === 'PAYG' || kind === 'SUBSCRIPTION';

  const nomiaPurchaseType =
    kind === 'BULK'
      ? ('BULK' as const)
      : kind === 'PAYG'
        ? ('PAYG' as const)
        : kind === 'SUBSCRIPTION'
          ? ('SUBSCRIPTION' as const)
          : undefined;

  const nomiaWhere: Prisma.OrganisationCreditPurchaseWhereInput = {
    status: OrganisationCreditPurchaseStatus.COMPLETED,
    ...(nomiaPurchaseType ? { purchaseType: nomiaPurchaseType } : {}),
    ...(trimmedQuery ? { OR: buildNomiaPurchaseSearchOr(trimmedQuery) } : {}),
  };

  const [nomiaRows, nomiaCount] = await Promise.all([
    includeNomia
      ? prisma.organisationCreditPurchase.findMany({
          where: nomiaWhere,
          take: ADMIN_PURCHASE_INVOICE_EXPORT_LIMIT,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            completedAt: true,
            credits: true,
            grossAmount: true,
            currency: true,
            paystackReference: true,
            purchaseType: true,
            organisation: {
              select: {
                name: true,
                url: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    includeNomia
      ? prisma.organisationCreditPurchase.count({ where: nomiaWhere })
      : Promise.resolve(0),
  ]);

  const nomiaMapped = nomiaRows.map((row) => ({
    id: row.id,
    invoiceId: resolveNomiaPurchaseInvoiceId({ purchaseId: row.id }),
    kind: mapNomiaPurchaseKind(row.purchaseType),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    status: 'COMPLETED' as const,
    credits: row.credits,
    grossAmount: row.grossAmount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    pricePerCreditCents: row.credits > 0 ? Math.round(row.grossAmount / row.credits) : 0,
    organisationName: row.organisation.name,
    organisationUrl: row.organisation.url,
    purchaserName: row.user.name,
    purchaserEmail: row.user.email,
  }));

  const merged = [...nomiaMapped].sort((a, b) => {
    const aTime = (a.completedAt ?? a.createdAt).getTime();
    const bTime = (b.completedAt ?? b.createdAt).getTime();

    return bTime - aTime;
  });

  const count = nomiaCount;

  return {
    data: merged.slice(0, ADMIN_PURCHASE_INVOICE_EXPORT_LIMIT),
    count,
    truncated: count > ADMIN_PURCHASE_INVOICE_EXPORT_LIMIT,
  };
};
