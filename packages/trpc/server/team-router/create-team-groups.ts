import { ALLOWED_TEAM_GROUP_TYPES, TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { TEAM_AUDIT_LOG_TYPE } from '@documenso/lib/types/team-audit-logs';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/generated/types';

import type { CreateTeamAuditLogDataResponse } from '@documenso/lib/utils/team-audit-logs';
import { createTeamAuditLogData } from '@documenso/lib/utils/team-audit-logs';

import { authenticatedProcedure } from '../trpc';
import { ZCreateTeamGroupsRequestSchema, ZCreateTeamGroupsResponseSchema } from './create-team-groups.types';

export const createTeamGroupsRoute = authenticatedProcedure
  // .meta(createTeamGroupsMeta)
  .input(ZCreateTeamGroupsRequestSchema)
  .output(ZCreateTeamGroupsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, groups } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
        groups,
      },
    });

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      include: {
        organisation: {
          include: {
            groups: {
              include: {
                teamGroups: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    // Hard validation — these failures indicate programming or authorisation
    // errors and should reject the whole request.
    const isValid = groups.every((group) => {
      const organisationGroup = team.organisation.groups.find(({ id }) => id === group.organisationGroupId);

      // Only allow specific organisation groups to be used as a reference for team groups.
      if (!organisationGroup?.type || !ALLOWED_TEAM_GROUP_TYPES.includes(organisationGroup.type)) {
        return false;
      }

      // The "EVERYONE" organisation group can only have the "TEAM MEMBER" role for now.
      if (
        organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
        organisationGroup.organisationRole === OrganisationMemberRole.MEMBER &&
        group.teamRole !== TeamMemberRole.MEMBER
      ) {
        return false;
      }

      // Check that the user has permission to add the group to the team.
      if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, group.teamRole)) {
        return false;
      }

      return true;
    });

    if (!isValid) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Invalid groups',
      });
    }

    // Silently drop groups already attached to the team. Makes the create
    // idempotent for the common race where a group was added between the
    // picker fetch and the submit.
    const filteredGroups = groups.filter((group) => {
      const organisationGroup = team.organisation.groups.find(({ id }) => id === group.organisationGroupId);

      return !organisationGroup?.teamGroups.some((teamGroup) => teamGroup.teamId === teamId);
    });

    if (filteredGroups.length === 0) {
      return;
    }

    await prisma.teamGroup.createMany({
      data: filteredGroups.map((group) => ({
        id: generateDatabaseId('team_group'),
        teamId,
        organisationGroupId: group.organisationGroupId,
        teamRole: group.teamRole,
      })),
    });

    const organisationGroupsById = new Map(
      team.organisation.groups.map((group) => [group.id, group]),
    );

    const auditLogs: CreateTeamAuditLogDataResponse[] = [];

    for (const group of groups) {
      const organisationGroup = organisationGroupsById.get(group.organisationGroupId);

      auditLogs.push(
        createTeamAuditLogData({
          teamId,
          type: TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ATTACHED,
          data: {
            organisationGroupId: group.organisationGroupId,
            organisationGroupName: organisationGroup?.name ?? null,
            teamRole: group.teamRole,
          },
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          metadata: ctx.metadata,
        }),
      );
    }

    if (auditLogs.length > 0) {
      await (prisma as any).teamAuditLog.createMany({
        data: auditLogs,
      });
    }
  });
