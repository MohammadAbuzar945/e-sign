import type { TemplateType } from '@prisma/client';
import { EnvelopeType, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { type FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';
import { getTeamById } from '../team/get-team';

export type FindTemplatesOptions = {
  userId: number;
  teamId: number;
  type?: TemplateType;
  page?: number;
  perPage?: number;
  folderId?: string;
};

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
  folderId,
}: FindTemplatesOptions) => {
  const whereFilter: Prisma.EnvelopeWhereInput[] = [];

  const team = await getTeamById({ userId, teamId });

  const isOrganisationOwner = team.organisation.ownerUserId === userId;
  const isTeamMember = team.teamGroups.length > 0;

  // Organisation owners who are not members of the team should not see team templates.
  if (isOrganisationOwner && !isTeamMember) {
    return {
      data: [],
      count: 0,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: 0,
    } satisfies FindResultResponse<unknown[]>;
  }

  const { teamRole } = await getMemberRoles({
    teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  });

  const where: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.TEMPLATE,
    templateType: type,
    AND: [
      { teamId },
      {
        OR: [
          {
            visibility: {
              in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
            },
          },
          { userId, teamId },
        ],
      },
      folderId ? { folderId } : { folderId: null },
    ],
  };

  const templateInclude = {
    team: {
      select: {
        id: true,
        url: true,
        name: true,
      },
    },
    fields: true,
    recipients: true,
    documentMeta: true,
    directLink: {
      select: {
        token: true,
        enabled: true,
      },
    },
  } as const;

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where,
      include: templateInclude,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({ where }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
