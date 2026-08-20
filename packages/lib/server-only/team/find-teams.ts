import type { Team } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { FindResultResponse } from '../../types/search-params';
import { getHighestTeamRoleInGroup } from '../../utils/teams';

export interface FindTeamsOptions {
  userId: number;
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const findTeams = async ({
  userId,
  organisationId,
  query,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamWhereInput = {
    organisation: {
      id: organisationId,
    },
    OR: [
      // Teams where the current user is a member via organisation groups.
      {
        teamGroups: {
          some: {
            organisationGroup: {
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    userId,
                  },
                },
              },
            },
          },
        },
      },
      // All teams in the organisation when the current user is the organisation owner.
      {
        organisation: {
          ownerUserId: userId,
        },
      },
    ],
  };

  if (query && query.length > 0) {
    whereClause.name = {
      contains: query,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.team.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        teamGroups: {
          where: {
            organisationGroup: {
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    userId,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.team.count({
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((team) => {
    return {
      ...team,
      currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
      // Durable usage counter — incremented on seal, never reduced when documents are deleted.
      completedDocumentCount: team.creditConsumed,
    };
  });

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof maskedData>;
};
