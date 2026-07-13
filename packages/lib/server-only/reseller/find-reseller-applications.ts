import type { Prisma } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { getNegativeCreditsUsed } from '@documenso/lib/utils/reseller-credits';
import { prisma } from '@documenso/prisma';

type FindResellerApplicationsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: string;
};

export const findResellerApplications = async ({
  query,
  page = 1,
  perPage = 10,
  status,
}: FindResellerApplicationsOptions) => {
  let whereClause: Prisma.ResellerApplicationWhereInput = {};

  if (status) {
    whereClause = {
      ...whereClause,
      status: status as Prisma.EnumResellerApplicationStatusFilter['equals'],
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
            resellerProfile: {
              select: {
                id: true,
                status: true,
                affiliateSlug: true,
                allowNegativeCredits: true,
              },
            },
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
      const resellerProfile = application.organisation.resellerProfile;

      if (!resellerProfile) {
        return {
          ...application,
          resellerProfile: null,
          liveCompletedDocCount: metrics.completedDocumentCount,
          liveUniqueSignerCount: metrics.uniqueSignerCount,
          liveOrgUserCount: metrics.orgUserCount,
        };
      }

      const availableCredits = await getOrganisationCredits(application.organisationId);

      return {
        ...application,
        resellerProfile: {
          ...resellerProfile,
          availableCredits,
          negativeCreditsUsed: getNegativeCreditsUsed(availableCredits),
        },
        liveCompletedDocCount: metrics.completedDocumentCount,
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
