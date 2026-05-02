import { TeamMemberRole } from '@prisma/client';

import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { getCurrentSubscriptionsByOrganisationIds } from '@documenso/lib/server-only/subscription/get-current-subscriptions-by-organisation-ids';
import {
  buildTeamWhereQuery,
  extractDerivedTeamSettings,
  getHighestTeamRoleInGroup,
} from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';

import { authenticatedProcedure } from '../trpc';
import type { TGetOrganisationSessionResponse } from './get-organisation-session.types';
import { ZGetOrganisationSessionResponseSchema } from './get-organisation-session.types';

/**
 * Get all the organisations and teams a user belongs to.
 */
export const getOrganisationSessionRoute = authenticatedProcedure
  .output(ZGetOrganisationSessionResponseSchema)
  .query(async ({ ctx }) => {
    return await getOrganisationSession({ userId: ctx.user.id });
  });

export const getOrganisationSession = async ({
  userId,
}: {
  userId: number;
}): Promise<TGetOrganisationSessionResponse> => {
  const organisations = await prisma.organisation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      groups: {
        where: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
      teams: {
        where: buildTeamWhereQuery({ teamId: undefined, userId }),
        include: {
          teamGlobalSettings: true,
          teamEmail: { select: { email: true } },
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
            include: {
              organisationGroup: true,
            },
          },
        },
      },
    },
  });

  const organisationIds = organisations.map((organisation) => organisation.id);

  const subscriptionsByOrganisationId = await getCurrentSubscriptionsByOrganisationIds({
    organisationIds,
  });

  let creditsByOrganisationId: Record<string, number> = {};

  try {
    const creditsEntries = await Promise.all(
      organisationIds.map(async (organisationId) => {
        try {
          const credits = await getOrganisationCredits(organisationId);

          return [organisationId, credits] as const;
        } catch {
          return [organisationId, 0] as const;
        }
      }),
    );

    creditsByOrganisationId = Object.fromEntries(creditsEntries);
  } catch {
    creditsByOrganisationId = {};
  }

  return organisations.map((organisation) => {
    const { organisationGlobalSettings } = organisation;

    return {
      ...organisation,
      subscription: subscriptionsByOrganisationId[organisation.id] ?? null,
      credits: creditsByOrganisationId[organisation.id] ?? 0,
      teams: organisation.teams.map((team) => {
        const derivedSettings = extractDerivedTeamSettings(
          organisationGlobalSettings,
          team.teamGlobalSettings,
        );

        const isOrganisationOwner = organisation.ownerUserId === userId;
            const isTeamMember = team.teamGroups.length > 0;

        return {
          ...team,
          currentTeamRole: isOrganisationOwner
            ? TeamMemberRole.ADMIN
            : getHighestTeamRoleInGroup(team.teamGroups),
              isTeamMember,
          preferences: {
            aiFeaturesEnabled: derivedSettings.aiFeaturesEnabled,
          },
        };
      }),
      currentOrganisationRole: getHighestOrganisationRoleInGroup(organisation.groups),
    };
  });
};
