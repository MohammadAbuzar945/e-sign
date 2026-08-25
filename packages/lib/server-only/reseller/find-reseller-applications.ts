import type { Prisma, ResellerApplicationStatus, ResellerProfile } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import {
  RESELLER_ADMIN_VIEW_STATUSES,
  type ResellerAdminApplicationsView,
} from '@documenso/lib/constants/reseller-application-status';
import {
  parseResellerBankAccountType,
  parseResellerBankDocumentType,
} from '@documenso/lib/constants/reseller-bank-verification';
import { parseResellerTermsVariableValues } from '@documenso/lib/constants/reseller-terms-variables';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { getNegativeCreditsUsed } from '@documenso/lib/utils/reseller-credits';
import { prisma } from '@documenso/prisma';

import { getResellerPayoutReadiness } from './reseller-payout-readiness';
import { decryptResellerSecret } from './reseller-secrets';

type ResellerProfileWithPayoutFields = ResellerProfile & {
  payoutMode: 'OWN_PAYSTACK' | 'NOMIA_SUBACCOUNT';
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankAccountType: string | null;
  bankDocumentType: string | null;
  bankDocumentNumber: string | null;
  paystackSubaccountCode: string | null;
  subaccountStatus: 'PENDING' | 'ACTIVE' | 'FAILED' | null;
  subaccountVerifiedAt: Date | null;
  subaccountFailureReason: string | null;
};

type FindResellerApplicationsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: string;
  view?: ResellerAdminApplicationsView;
};

export const findResellerApplications = async ({
  query,
  page = 1,
  perPage = 10,
  status,
  view,
}: FindResellerApplicationsOptions) => {
  let whereClause: Prisma.ResellerApplicationWhereInput = {};

  if (view && RESELLER_ADMIN_VIEW_STATUSES[view]) {
    whereClause = {
      ...whereClause,
      status: {
        in: RESELLER_ADMIN_VIEW_STATUSES[view] as ResellerApplicationStatus[],
      },
    };
  } else if (status) {
    whereClause = {
      ...whereClause,
      status: status as ResellerApplicationStatus,
    };
  }

  if (query) {
    whereClause = {
      ...whereClause,
      OR: [
        {
          snapshotOrgName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          snapshotApplicantName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          snapshotApplicantEmail: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          organisationId: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    };
  }

  const [data, count] = await Promise.all([
    prisma.resellerApplication.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        appliedAt: 'desc',
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
            createdAt: true,
            resellerProfile: true,
          },
        },
        applicantUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.resellerApplication.count({
      where: whereClause,
    }),
  ]);

  const enrichedData = await Promise.all(
    data.map(async (application) => {
      const metrics = await getLiveApplicationMetrics(application.organisationId);
      const resellerProfile = application.organisation
        .resellerProfile as ResellerProfileWithPayoutFields | null;

      if (!resellerProfile) {
        return {
          ...application,
          termsVariableValues: parseResellerTermsVariableValues(application.termsVariableValues),
          resellerProfile: null,
          liveCompletedDocCount: metrics.creditsConsumed,
          liveUniqueSignerCount: metrics.uniqueSignerCount,
          liveOrgUserCount: metrics.orgUserCount,
        };
      }

      const availableCredits = await getOrganisationCredits(application.organisationId);
      const payoutReadiness = getResellerPayoutReadiness({
        payoutMode: resellerProfile.payoutMode,
        paystackPublicKey: resellerProfile.paystackPublicKey,
        paystackSecretKey: resellerProfile.paystackSecretKey,
        paystackSubaccountCode: resellerProfile.paystackSubaccountCode,
        subaccountStatus: resellerProfile.subaccountStatus,
      });

      return {
        ...application,
        termsVariableValues: parseResellerTermsVariableValues(application.termsVariableValues),
        resellerProfile: {
          id: resellerProfile.id,
          status: resellerProfile.status,
          affiliateSlug: resellerProfile.affiliateSlug,
          allowNegativeCredits: resellerProfile.allowNegativeCredits,
          isDelinquent: resellerProfile.isDelinquent,
          delinquentAt: resellerProfile.delinquentAt,
          zeroBalanceSince: resellerProfile.zeroBalanceSince,
          payoutMode: resellerProfile.payoutMode,
          bankCode: resellerProfile.bankCode,
          bankName: resellerProfile.bankName,
          bankAccountNumber: resellerProfile.bankAccountNumber
            ? decryptResellerSecret(resellerProfile.bankAccountNumber)
            : null,
          bankAccountName: resellerProfile.bankAccountName,
          bankAccountType: parseResellerBankAccountType(resellerProfile.bankAccountType),
          bankDocumentType: parseResellerBankDocumentType(resellerProfile.bankDocumentType),
          physicalAddress: resellerProfile.physicalAddress,
          contactPhone: resellerProfile.contactPhone,
          contactEmail: resellerProfile.contactEmail,
          vatStatus: resellerProfile.vatStatus,
          vatNumber: resellerProfile.vatNumber,
          bankDetailsConfirmedAt: resellerProfile.bankDetailsConfirmedAt,
          paystackSubaccountCode: resellerProfile.paystackSubaccountCode,
          subaccountStatus: resellerProfile.subaccountStatus,
          subaccountVerifiedAt: resellerProfile.subaccountVerifiedAt,
          subaccountFailureReason: resellerProfile.subaccountFailureReason,
          availableCredits,
          negativeCreditsUsed: getNegativeCreditsUsed(availableCredits),
          payoutReadiness: {
            canAcceptPayments: payoutReadiness.canAcceptPayments,
            hasOwnPaystackConfigured: payoutReadiness.hasOwnPaystackConfigured,
            hasNomiaSubaccountConfigured: payoutReadiness.hasNomiaSubaccountConfigured,
            blockingReason: payoutReadiness.blockingReason ?? null,
          },
        },
        liveCompletedDocCount: metrics.creditsConsumed,
        liveUniqueSignerCount: metrics.uniqueSignerCount,
        liveOrgUserCount: metrics.orgUserCount,
      };
    }),
  );

  return {
    data: enrichedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof enrichedData>;
};

const getLiveApplicationMetrics = async (organisationId: string) => {
  const { getOrganisationResellerMetrics } = await import('./get-reseller-eligibility');
  return await getOrganisationResellerMetrics(organisationId);
};
