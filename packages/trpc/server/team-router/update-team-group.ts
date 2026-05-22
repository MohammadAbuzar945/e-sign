import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { TEAM_AUDIT_LOG_TYPE } from '@documenso/lib/types/team-audit-logs';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@documenso/prisma/generated/types';

import { createTeamAuditLogData } from '@documenso/lib/utils/team-audit-logs';
import { authenticatedProcedure } from '../trpc';
import { ZUpdateTeamGroupRequestSchema, ZUpdateTeamGroupResponseSchema } from './update-team-group.types';

export const updateTeamGroupRoute = authenticatedProcedure
  // .meta(updateTeamGroupMeta)
  .input(ZUpdateTeamGroupRequestSchema)
  .output(ZUpdateTeamGroupResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, data } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        id,
        data: {
          teamRole: data.teamRole,
        },
      },
    });

    const teamGroup = await prisma.teamGroup.findFirst({
      where: {
        id,
        team: buildTeamWhereQuery({
          teamId: undefined,
          userId: user.id,
          roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
        }),
      },
      include: {
        organisationGroup: true,
      },
    });

    if (!teamGroup) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team group not found',
      });
    }

    if (teamGroup.organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update internal organisation groups',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId: teamGroup.teamId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, teamGroup.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update this team group',
      });
    }

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, data.teamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to set a team role higher than your own',
      });
    }

    await prisma.teamGroup.update({
      where: {
        id,
      },
      data: {
        teamRole: data.teamRole,
      },
    });

    await (prisma as any).teamAuditLog.create({
      data: createTeamAuditLogData({
        teamId: teamGroup.teamId,
        type: TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ROLE_UPDATED,
        data: {
          organisationGroupId: teamGroup.organisationGroupId,
          organisationGroupName: teamGroup.organisationGroup.name ?? null,
          previousRole: teamGroup.teamRole,
          newRole: data.teamRole,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        metadata: ctx.metadata,
      }),
    });
  });
