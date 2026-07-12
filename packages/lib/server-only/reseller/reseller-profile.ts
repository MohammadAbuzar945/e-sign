import type { Prisma } from '@prisma/client';
import { ResellerProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { getPaystackWebhookUrl, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { prisma } from '@documenso/prisma';

export const getResellerProfileByOrganisationId = async (organisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    include: {
      packages: {
        orderBy: {
          creditAmount: 'asc',
        },
      },
      organisation: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  const availableCredits = await getOrganisationCredits(organisationId);

  return {
    ...profile,
    availableCredits,
    affiliateUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/r/${profile.affiliateSlug}`,
    paystackWebhookUrl: getPaystackWebhookUrl(),
    catalogPackages: ESIGN_CREDIT_PACKAGES,
  };
};

export const getResellerProfileByAffiliateSlug = async (affiliateSlug: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    include: {
      packages: {
        where: { isEnabled: true },
        orderBy: {
          creditAmount: 'asc',
        },
      },
      organisation: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
    },
  });

  if (!profile || profile.status !== ResellerProfileStatus.ACTIVE) {
    return null;
  }

  const availableCredits = await getOrganisationCredits(profile.organisationId);

  return {
    ...profile,
    availableCredits,
  };
};

export type UpdateResellerProfileOptions = {
  organisationId: string;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  paystackCallbackUrl?: string;
  vatNumber?: string;
  instructionsDismissed?: boolean;
  brandingEnabled?: boolean;
  brandingLogo?: string | null;
  brandingUrl?: string | null;
  brandingCompanyDetails?: string | null;
  brandingPrimaryColor?: string | null;
  affiliatePageTitle?: string | null;
  affiliatePageDescription?: string | null;
  affiliateAboutText?: string | null;
  affiliateSupportEmail?: string | null;
  highlightedCatalogPackageId?: string | null;
};

export const updateResellerProfile = async ({
  organisationId,
  paystackPublicKey,
  paystackSecretKey,
  paystackCallbackUrl,
  vatNumber,
  instructionsDismissed,
  brandingEnabled,
  brandingLogo,
  brandingUrl,
  brandingCompanyDetails,
  brandingPrimaryColor,
  affiliatePageTitle,
  affiliatePageDescription,
  affiliateAboutText,
  affiliateSupportEmail,
  highlightedCatalogPackageId,
}: UpdateResellerProfileOptions) => {
  const trimmedSecretKey = paystackSecretKey?.trim();

  return await prisma.resellerProfile.update({
    where: { organisationId },
    data: {
      paystackPublicKey,
      ...(trimmedSecretKey ? { paystackSecretKey: trimmedSecretKey } : {}),
      paystackCallbackUrl,
      vatNumber,
      instructionsDismissedAt: instructionsDismissed ? new Date() : undefined,
      brandingEnabled,
      brandingLogo,
      brandingUrl,
      brandingCompanyDetails,
      brandingPrimaryColor,
      affiliatePageTitle,
      affiliatePageDescription,
      affiliateAboutText,
      affiliateSupportEmail,
      highlightedCatalogPackageId,
    },
  });
};

export const updateResellerPackages = async ({
  organisationId,
  enabledCatalogPackageIds,
}: {
  organisationId: string;
  enabledCatalogPackageIds: string[];
}) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    include: { packages: true },
  });

  if (!profile) {
    throw new Error('Reseller profile not found');
  }

  await Promise.all(
    profile.packages.map((pkg) =>
      prisma.resellerPackage.update({
        where: { id: pkg.id },
        data: {
          isEnabled: enabledCatalogPackageIds.includes(pkg.catalogPackageId),
        },
      }),
    ),
  );

  return await getResellerProfileByOrganisationId(organisationId);
};

type FindResellerTransactionsOptions = {
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
  fromDate?: Date;
  toDate?: Date;
};

export const RESELLER_TRANSACTION_EXPORT_LIMIT = 10_000;

const normalizeTransactionDateRange = ({
  fromDate,
  toDate,
}: {
  fromDate?: Date;
  toDate?: Date;
}) => {
  let normalizedFromDate: Date | undefined;
  let normalizedToDate: Date | undefined;

  if (fromDate) {
    normalizedFromDate = new Date(fromDate);
    normalizedFromDate.setHours(0, 0, 0, 0);
  }

  if (toDate) {
    normalizedToDate = new Date(toDate);
    normalizedToDate.setHours(23, 59, 59, 999);
  }

  return {
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
  };
};

const buildResellerTransactionWhereClause = ({
  resellerProfileId,
  query,
  fromDate,
  toDate,
}: {
  resellerProfileId: string;
  query?: string;
  fromDate?: Date;
  toDate?: Date;
}) => {
  const { fromDate: normalizedFromDate, toDate: normalizedToDate } =
    normalizeTransactionDateRange({ fromDate, toDate });

  let whereClause: Prisma.ResellerCreditTransactionWhereInput = {
    resellerProfileId,
  };

  if (query) {
    whereClause = {
      ...whereClause,
      OR: [
        {
          purchaserName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          purchaserEmail: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          purchaserOrganisationName: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    };
  }

  if (normalizedFromDate || normalizedToDate) {
    whereClause = {
      ...whereClause,
      createdAt: {
        ...(normalizedFromDate ? { gte: normalizedFromDate } : {}),
        ...(normalizedToDate ? { lte: normalizedToDate } : {}),
      },
    };
  }

  return whereClause;
};

export const findResellerTransactions = async ({
  organisationId,
  query,
  page = 1,
  perPage = 20,
  fromDate,
  toDate,
}: FindResellerTransactionsOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
  });

  if (!profile) {
    return {
      data: [],
      count: 0,
      currentPage: 1,
      perPage,
      totalPages: 0,
    };
  }

  const whereClause = buildResellerTransactionWhereClause({
    resellerProfileId: profile.id,
    query,
    fromDate,
    toDate,
  });

  const [data, count] = await Promise.all([
    prisma.resellerCreditTransaction.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        package: true,
      },
    }),
    prisma.resellerCreditTransaction.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};

export const exportResellerTransactions = async ({
  organisationId,
  query,
  fromDate,
  toDate,
}: Omit<FindResellerTransactionsOptions, 'page' | 'perPage'>) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    include: {
      organisation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!profile) {
    return {
      resellerOrganisationName: '',
      resellerVatNumber: null,
      data: [],
      count: 0,
      truncated: false,
    };
  }

  const whereClause = buildResellerTransactionWhereClause({
    resellerProfileId: profile.id,
    query,
    fromDate,
    toDate,
  });

  const count = await prisma.resellerCreditTransaction.count({
    where: whereClause,
  });

  const data = await prisma.resellerCreditTransaction.findMany({
    where: whereClause,
    take: RESELLER_TRANSACTION_EXPORT_LIMIT,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return {
    resellerOrganisationName: profile.organisation.name,
    resellerVatNumber: profile.vatNumber,
    data,
    count,
    truncated: count > RESELLER_TRANSACTION_EXPORT_LIMIT,
  };
};
