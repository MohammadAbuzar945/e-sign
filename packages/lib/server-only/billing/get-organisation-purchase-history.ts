import {
  OrganisationCreditPurchaseStatus,
  ResellerCreditTransactionStatus,
  type OrganisationCreditPurchase,
  type ResellerCreditTransaction,
  type Subscription,
} from '@prisma/client';

import { formatNomiaSubscriptionPlanTitle } from '@documenso/lib/constants/nomia-subscription-plans';
import {
  findNomiaSubscriptionPlanForCharge,
  getNomiaSubscriptionPlanDetails,
  type NomiaSubscriptionPlanDetails,
} from '@documenso/lib/constants/nomia-subscription-plans';
import {
  listNomiaPricePlans,
  type NomiaPricePlanRow,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

import { getSubscriptionsByUserId } from '../subscription/get-subscriptions-by-user-id';
import { resolveResellerDisplayName } from '../reseller/reseller-association';
import {
  resolveNomiaPurchaseInvoiceId,
  resolveResellerPurchaseInvoiceId,
} from './record-organisation-credit-purchase';

export const DEFAULT_PURCHASE_HISTORY_PER_PAGE = 20;

const PURCHASE_HISTORY_STATUSES = [
  OrganisationCreditPurchaseStatus.COMPLETED,
  OrganisationCreditPurchaseStatus.PENDING,
] as const;

const RESELLER_HISTORY_STATUSES = [
  ResellerCreditTransactionStatus.COMPLETED,
  ResellerCreditTransactionStatus.PENDING,
] as const;

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
  kind: 'subscription' | 'pay_as_you_go' | 'reseller' | 'bulk';
  /** Who issues / supplies this invoice document. */
  issuer: 'NOMIA' | 'RESELLER';
  title: string;
  totalCredits: number;
  totalGrossAmount: number;
  currency: string;
  status: string;
  lineItems: PurchaseHistoryLineItem[];
  /** Present when this invoice is issued by a reseller. */
  resellerSeller?: PurchaseInvoiceResellerSeller | null;
  /**
   * Buyer VAT number when the purchasing org is itself a VAT-registered
   * reseller (Nomia tax invoices only). Ordinary orgs never store buyer VAT.
   */
  buyerVatNumber?: string | null;
};

export type OrganisationPurchaseHistoryResult =
  FindResultResponse<OrganisationPurchaseHistoryItem[]>;

const formatAmount = (currency: string, amountInCents: number) =>
  `${currency} ${(amountInCents / 100).toFixed(2)}`;

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

const resolveResellerSellerFromTransaction = (transaction: {
  sellerDisplayName: string | null;
  sellerPhysicalAddress: string | null;
  sellerAffiliateSlug: string | null;
  sellerVatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  sellerVatNumber: string | null;
  resellerProfile: {
    organisation: { name: string };
    brandingCompanyDetails: string | null;
    physicalAddress: string | null;
    vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
    vatNumber: string | null;
    affiliateSlug: string;
    brandingEnabled: boolean;
    brandingLogo: string | null;
  } | null;
}): { resellerDisplayName: string; resellerSeller: PurchaseInvoiceResellerSeller } => {
  if (transaction.resellerProfile) {
    const liveSeller = buildResellerSellerDetails(transaction.resellerProfile);

    return {
      resellerDisplayName: getResellerPurchaseDisplayName(transaction.resellerProfile),
      resellerSeller: {
        ...liveSeller,
        vatStatus: transaction.sellerVatStatus ?? liveSeller.vatStatus,
        vatNumber: transaction.sellerVatNumber ?? liveSeller.vatNumber,
      },
    };
  }

  const resellerDisplayName = transaction.sellerDisplayName?.trim() || 'Reseller';

  return {
    resellerDisplayName,
    resellerSeller: {
      name: resellerDisplayName,
      physicalAddress: transaction.sellerPhysicalAddress,
      vatStatus: transaction.sellerVatStatus,
      vatNumber: transaction.sellerVatNumber,
      affiliateSlug: transaction.sellerAffiliateSlug?.trim() || '',
      hasLogo: false,
    },
  };
};

const resellerTransactionInclude = {
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
} as const;

type ResellerTransactionWithRelations = ResellerCreditTransaction & {
  package: {
    creditAmount: number;
    catalogPackageId: string;
  } | null;
  resellerProfile: {
    affiliateSlug: string;
    brandingEnabled: boolean;
    brandingLogo: string | null;
    brandingCompanyDetails: string | null;
    physicalAddress: string | null;
    vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
    vatNumber: string | null;
    organisation: { name: string };
  } | null;
};

/**
 * Ordinary organisations do not store buyer VAT.
 * Only when the buyer org is itself a VAT-registered reseller.
 */
export const resolveBuyerVatNumberForOrganisation = async (organisationId: string) => {
  const buyerResellerProfile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: {
      vatStatus: true,
      vatNumber: true,
    },
  });

  if (
    buyerResellerProfile?.vatStatus === 'REGISTERED' &&
    buyerResellerProfile.vatNumber?.trim()
  ) {
    return buyerResellerProfile.vatNumber.trim();
  }

  return null;
};

const resolveSubscriptionPlanFromCatalogRows = ({
  catalogRows,
  planCode,
  credits,
  priceInCents,
}: {
  catalogRows: NomiaPricePlanRow[];
  planCode?: string | null;
  credits?: number | null;
  priceInCents?: number | null;
}): NomiaSubscriptionPlanDetails | null => {
  if (planCode) {
    const byCode = catalogRows.find(
      (row) =>
        (row.category === 'MONTHLY' || row.category === 'ANNUAL') &&
        (row.paystackPlanCodeTest === planCode || row.paystackPlanCodeLive === planCode),
    );

    if (byCode) {
      return {
        planCode,
        name: byCode.name,
        label: byCode.category === 'MONTHLY' ? 'Monthly' : 'Annually',
        credits: byCode.credits,
        priceInCents: byCode.priceInCents,
      };
    }

    const seedMatch = getNomiaSubscriptionPlanDetails(planCode);

    if (seedMatch) {
      return seedMatch;
    }
  }

  if (credits == null || priceInCents == null) {
    return null;
  }

  const byCharge = catalogRows.find(
    (row) =>
      (row.category === 'MONTHLY' || row.category === 'ANNUAL') &&
      row.credits === credits &&
      row.priceInCents === priceInCents,
  );

  if (byCharge) {
    return {
      planCode: planCode ?? byCharge.paystackPlanCodeLive,
      name: byCharge.name,
      label: byCharge.category === 'MONTHLY' ? 'Monthly' : 'Annually',
      credits: byCharge.credits,
      priceInCents: byCharge.priceInCents,
    };
  }

  return findNomiaSubscriptionPlanForCharge({
    planCode,
    credits,
    priceInCents,
  });
};

const mapNomiaPurchaseToHistoryItem = ({
  purchase,
  buyerVatNumber,
  catalogRows,
}: {
  purchase: OrganisationCreditPurchase;
  buyerVatNumber: string | null;
  catalogRows: NomiaPricePlanRow[];
}): OrganisationPurchaseHistoryItem => {
  const isBulk = purchase.purchaseType === 'BULK';
  const isSubscription = purchase.purchaseType === 'SUBSCRIPTION';

  const subscriptionPlan = isSubscription
    ? resolveSubscriptionPlanFromCatalogRows({
        catalogRows,
        credits: purchase.credits,
        priceInCents: purchase.grossAmount,
      })
    : null;

  const title = isBulk
    ? 'Bulk inventory top-up'
    : isSubscription
      ? formatNomiaSubscriptionPlanTitle(subscriptionPlan)
      : 'Pay as you go top-up';

  const kind = isBulk ? 'bulk' : isSubscription ? 'subscription' : 'pay_as_you_go';

  return {
    invoiceId: resolveNomiaPurchaseInvoiceId({ purchaseId: purchase.id }),
    purchaseGroupId: purchase.purchaseGroupId,
    date: purchase.completedAt ?? purchase.createdAt,
    kind,
    issuer: 'NOMIA',
    title,
    totalCredits: purchase.credits,
    totalGrossAmount: purchase.grossAmount,
    currency: purchase.currency,
    status: purchase.status,
    buyerVatNumber,
    lineItems: [
      buildNomiaLineItem({
        credits: purchase.credits,
        grossAmount: purchase.grossAmount,
        currency: purchase.currency,
        status: purchase.status,
        reference: isSubscription
          ? (subscriptionPlan?.planCode ?? purchase.paystackReference)
          : purchase.paystackReference,
        description: title,
      }),
    ],
  };
};

const mapResellerTransactionToHistoryItem = (
  transaction: ResellerTransactionWithRelations,
): OrganisationPurchaseHistoryItem => {
  const { resellerDisplayName, resellerSeller } = resolveResellerSellerFromTransaction(transaction);

  return {
    invoiceId: resolveResellerPurchaseInvoiceId({ transactionId: transaction.id }),
    purchaseGroupId: transaction.purchaseGroupId,
    date: transaction.completedAt ?? transaction.createdAt,
    kind: 'reseller',
    issuer: 'RESELLER',
    title: `Credits from ${resellerDisplayName}`,
    totalCredits: transaction.credits,
    totalGrossAmount: transaction.grossAmount,
    currency: transaction.currency,
    status: transaction.status,
    resellerSeller,
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
  };
};

const mapLegacySubscriptionToHistoryItem = ({
  subscription,
  buyerVatNumber,
  catalogRows,
}: {
  subscription: Subscription;
  buyerVatNumber: string | null;
  catalogRows: NomiaPricePlanRow[];
}): OrganisationPurchaseHistoryItem => {
  const planCode = subscription.priceId || subscription.planId;
  const planDetails = resolveSubscriptionPlanFromCatalogRows({
    catalogRows,
    planCode,
  });
  const credits = planDetails?.credits ?? 0;
  const grossAmount = planDetails?.priceInCents ?? 0;
  const title = formatNomiaSubscriptionPlanTitle(planDetails, planCode);
  const status = subscription.status === 'PAST_DUE' ? 'INCOMPLETE' : subscription.status;

  return {
    invoiceId: `subscription_${subscription.id}`,
    purchaseGroupId: null,
    date: subscription.updatedAt,
    kind: 'subscription',
    issuer: 'NOMIA',
    title,
    totalCredits: credits,
    totalGrossAmount: grossAmount,
    currency: 'ZAR',
    status,
    buyerVatNumber,
    lineItems: [
      {
        provider: 'nomia',
        description: title,
        credits,
        grossAmount,
        currency: 'ZAR',
        status,
        reference: planCode,
      },
    ],
  };
};

const sortHistoryItemsDesc = (items: OrganisationPurchaseHistoryItem[]) =>
  [...items].sort((left, right) => right.date.getTime() - left.date.getTime());

export const getOrganisationPurchaseHistory = async ({
  organisationId,
  page = 1,
  perPage = DEFAULT_PURCHASE_HISTORY_PER_PAGE,
}: {
  organisationId: string;
  page?: number;
  perPage?: number;
}): Promise<OrganisationPurchaseHistoryResult> => {
  const safePage = Math.max(page, 1);
  const safePerPage = Math.min(Math.max(perPage, 1), 100);
  const windowSize = safePage * safePerPage;

  const [
    subscriptions,
    payAsYouGoPurchases,
    payAsYouGoCount,
    resellerPurchases,
    resellerCount,
    subscriptionChargeCount,
    buyerVatNumber,
    catalogRows,
  ] = await Promise.all([
    getSubscriptionsByUserId({ organisationId }),
    prisma.organisationCreditPurchase.findMany({
      where: {
        organisationId,
        status: { in: [...PURCHASE_HISTORY_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
    }),
    prisma.organisationCreditPurchase.count({
      where: {
        organisationId,
        status: { in: [...PURCHASE_HISTORY_STATUSES] },
      },
    }),
    prisma.resellerCreditTransaction.findMany({
      where: {
        purchaserOrganisationId: organisationId,
        status: { in: [...RESELLER_HISTORY_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
      include: resellerTransactionInclude,
    }),
    prisma.resellerCreditTransaction.count({
      where: {
        purchaserOrganisationId: organisationId,
        status: { in: [...RESELLER_HISTORY_STATUSES] },
      },
    }),
    prisma.organisationCreditPurchase.count({
      where: {
        organisationId,
        purchaseType: 'SUBSCRIPTION',
        status: { in: [...PURCHASE_HISTORY_STATUSES] },
      },
    }),
    resolveBuyerVatNumberForOrganisation(organisationId),
    listNomiaPricePlans(),
  ]);

  const includeLegacySubscriptions = subscriptionChargeCount === 0;
  const legacySubscriptionCount = includeLegacySubscriptions ? subscriptions.length : 0;

  const items: OrganisationPurchaseHistoryItem[] = [
    ...payAsYouGoPurchases.map((purchase) =>
      mapNomiaPurchaseToHistoryItem({
        purchase,
        buyerVatNumber,
        catalogRows,
      }),
    ),
    ...resellerPurchases.map((transaction) =>
      mapResellerTransactionToHistoryItem(transaction as ResellerTransactionWithRelations),
    ),
  ];

  if (includeLegacySubscriptions) {
    items.push(
      ...subscriptions.map((subscription) =>
        mapLegacySubscriptionToHistoryItem({
          subscription,
          buyerVatNumber,
          catalogRows,
        }),
      ),
    );
  }

  const sorted = sortHistoryItemsDesc(items);
  const start = (safePage - 1) * safePerPage;
  const data = sorted.slice(start, start + safePerPage);
  const count = payAsYouGoCount + resellerCount + legacySubscriptionCount;

  return {
    data,
    count,
    currentPage: safePage,
    perPage: safePerPage,
    totalPages: Math.max(1, Math.ceil(count / safePerPage)),
  };
};

const findNomiaPurchaseHistoryItem = async ({
  organisationId,
  purchaseId,
  buyerVatNumber,
  catalogRows,
}: {
  organisationId: string;
  purchaseId: string;
  buyerVatNumber: string | null;
  catalogRows: NomiaPricePlanRow[];
}) => {
  const purchase = await prisma.organisationCreditPurchase.findFirst({
    where: {
      id: purchaseId,
      organisationId,
      status: { in: [...PURCHASE_HISTORY_STATUSES] },
    },
  });

  if (!purchase) {
    return null;
  }

  return mapNomiaPurchaseToHistoryItem({
    purchase,
    buyerVatNumber,
    catalogRows,
  });
};

const findResellerPurchaseHistoryItem = async ({
  organisationId,
  transactionId,
}: {
  organisationId: string;
  transactionId: string;
}) => {
  const transaction = await prisma.resellerCreditTransaction.findFirst({
    where: {
      id: transactionId,
      purchaserOrganisationId: organisationId,
      status: { in: [...RESELLER_HISTORY_STATUSES] },
    },
    include: resellerTransactionInclude,
  });

  if (!transaction) {
    return null;
  }

  return mapResellerTransactionToHistoryItem(transaction as ResellerTransactionWithRelations);
};

const findLegacySubscriptionHistoryItem = async ({
  organisationId,
  subscriptionId,
  buyerVatNumber,
  catalogRows,
}: {
  organisationId: string;
  subscriptionId: string;
  buyerVatNumber: string | null;
  catalogRows: NomiaPricePlanRow[];
}) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      organisationId,
    },
  });

  if (!subscription) {
    return null;
  }

  return mapLegacySubscriptionToHistoryItem({
    subscription,
    buyerVatNumber,
    catalogRows,
  });
};

/**
 * Resolve one or more invoices without loading the full purchase ledger.
 */
export const findOrganisationPurchaseHistoryItems = async ({
  organisationId,
  invoiceId,
  invoiceIds,
  purchaseGroupId,
}: {
  organisationId: string;
  invoiceId?: string;
  invoiceIds?: string[];
  purchaseGroupId?: string | null;
}): Promise<OrganisationPurchaseHistoryItem[]> => {
  const [buyerVatNumber, catalogRows] = await Promise.all([
    resolveBuyerVatNumberForOrganisation(organisationId),
    listNomiaPricePlans(),
  ]);

  if (purchaseGroupId) {
    const [nomiaPurchases, resellerPurchases] = await Promise.all([
      prisma.organisationCreditPurchase.findMany({
        where: {
          organisationId,
          purchaseGroupId,
          status: { in: [...PURCHASE_HISTORY_STATUSES] },
        },
      }),
      prisma.resellerCreditTransaction.findMany({
        where: {
          purchaserOrganisationId: organisationId,
          purchaseGroupId,
          status: { in: [...RESELLER_HISTORY_STATUSES] },
        },
        include: resellerTransactionInclude,
      }),
    ]);

    const items = [
      ...nomiaPurchases.map((purchase) =>
        mapNomiaPurchaseToHistoryItem({
          purchase,
          buyerVatNumber,
          catalogRows,
        }),
      ),
      ...resellerPurchases.map((transaction) =>
        mapResellerTransactionToHistoryItem(transaction as ResellerTransactionWithRelations),
      ),
    ].sort((a, b) => {
      if (a.issuer === b.issuer) {
        return a.invoiceId.localeCompare(b.invoiceId);
      }

      return a.issuer === 'RESELLER' ? -1 : 1;
    });

    if (items.length > 0) {
      return items;
    }
  }

  const idsToResolve = [
    ...(invoiceIds ?? []),
    ...(invoiceId ? [invoiceId] : []),
  ].filter((id, index, all) => all.indexOf(id) === index);

  const resolved: OrganisationPurchaseHistoryItem[] = [];

  for (const id of idsToResolve) {
    if (id.startsWith('nomia_')) {
      const item = await findNomiaPurchaseHistoryItem({
        organisationId,
        purchaseId: id.slice('nomia_'.length),
        buyerVatNumber,
        catalogRows,
      });

      if (item) {
        resolved.push(item);
      }

      continue;
    }

    if (id.startsWith('reseller_')) {
      const item = await findResellerPurchaseHistoryItem({
        organisationId,
        transactionId: id.slice('reseller_'.length),
      });

      if (item) {
        resolved.push(item);
      }

      continue;
    }

    if (id.startsWith('subscription_')) {
      const item = await findLegacySubscriptionHistoryItem({
        organisationId,
        subscriptionId: id.slice('subscription_'.length),
        buyerVatNumber,
        catalogRows,
      });

      if (item) {
        resolved.push(item);
      }

      continue;
    }

    // Legacy hybrid emails used purchaseGroupId as the invoice id.
    const groupItems = await findOrganisationPurchaseHistoryItems({
      organisationId,
      purchaseGroupId: id,
    });

    if (groupItems.length > 0) {
      const resellerFirst =
        groupItems.find((item) => item.issuer === 'RESELLER') ?? groupItems[0];

      resolved.push(resellerFirst);
    }
  }

  return resolved;
};

export { formatAmount };
