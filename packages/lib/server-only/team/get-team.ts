import { TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { normalizeStoredKbaSettings } from '../../utils/kba-settings';
import {
  buildTeamWhereQuery,
  extractDerivedTeamSettings,
  getHighestTeamRoleInGroup,
} from '../../utils/teams';

export type GetTeamByIdOptions = {
  userId: number;
  teamId: number;
};

export const getTeamById = async ({ userId, teamId }: GetTeamByIdOptions) => {
  return await getTeam({
    teamReference: teamId,
    userId,
  });
};

export type GetTeamByUrlOptions = {
  userId: number;
  teamUrl: string;
};

export type TGetTeamByUrlResponse = Awaited<ReturnType<typeof getTeamByUrl>>;

/**
 * Get a team given a team URL.
 */
export const getTeamByUrl = async ({ userId, teamUrl }: GetTeamByUrlOptions) => {
  return await getTeam({
    teamReference: teamUrl,
    userId,
  });
};

/**
 * Get a team by its ID or URL.
 */
export const getTeam = async ({
  teamReference,
  userId,
}: {
  teamReference: number | string;
  userId: number;
}) => {
  const team = await prisma.team.findFirst({
    where: {
      ...buildTeamWhereQuery({ teamId: undefined, userId }),
      id: typeof teamReference === 'number' ? teamReference : undefined,
      url: typeof teamReference === 'string' ? teamReference : undefined,
    },
    include: {
      teamEmail: true,
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
      teamGlobalSettings: true,
      organisation: {
        include: {
          organisationGlobalSettings: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const organisationSettings = team.organisation.organisationGlobalSettings;
  const teamSettings = team.teamGlobalSettings;

  const isOrganisationOwner = team.organisation.ownerUserId === userId;
  const currentTeamRole = isOrganisationOwner
    ? TeamMemberRole.ADMIN
    : getHighestTeamRoleInGroup(team.teamGroups);

  return {
    ...team,
    currentTeamRole,
    teamSettings,
    derivedSettings: extractDerivedTeamSettings(organisationSettings, teamSettings),
    organisationKbaSettings: normalizeStoredKbaSettings(organisationSettings.kbaSettings),
  };
};
