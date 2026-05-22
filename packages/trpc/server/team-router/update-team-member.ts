import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { TEAM_AUDIT_LOG_TYPE } from '@documenso/lib/types/team-audit-logs';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, TeamMemberRole } from '@documenso/prisma/generated/types';
import { match } from 'ts-pattern';

import { createTeamAuditLogData } from '@documenso/lib/utils/team-audit-logs';

import { authenticatedProcedure } from '../trpc';
import { ZUpdateTeamMemberRequestSchema, ZUpdateTeamMemberResponseSchema } from './update-team-member.types';

export const updateTeamMemberRoute = authenticatedProcedure
  //   .meta(updateTeamMemberMeta)
  .input(ZUpdateTeamMemberRequestSchema)
  .output(ZUpdateTeamMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, memberId, data } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        teamId,
        memberId,
      },
    });

    const team = await prisma.team.findFirst({
      where: {
        AND: [
          buildTeamWhereQuery({
            teamId,
            userId,
            roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
          }),
          {
            organisation: {
              members: {
                some: {
                  id: memberId,
                },
              },
            },
          },
        ],
      },
      include: {
        organisation: {
          include: {
            members: true,
          },
        },
        teamGroups: {
          where: {
            organisationGroup: {
              type: OrganisationGroupType.INTERNAL_TEAM,
            },
          },
          include: {
            organisationGroup: {
              include: {
                organisationGroupMembers: {
                  include: {
                    organisationMember: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found' });
    }

    const internalTeamGroupToRemoveMemberFrom = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.organisationGroup.organisationGroupMembers.some((member) => member.organisationMemberId === memberId),
    );

    const teamMemberGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MEMBER,
    );

    const teamManagerGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.MANAGER,
    );

    const teamAdminGroup = team.teamGroups.find(
      (group) =>
        group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
        group.teamId === teamId &&
        group.teamRole === TeamMemberRole.ADMIN,
    );

    if (!teamMemberGroup || !teamManagerGroup || !teamAdminGroup) {
      console.error({
        message: 'Team groups not found.',
        teamMemberGroup: Boolean(teamMemberGroup),
        teamManagerGroup: Boolean(teamManagerGroup),
        teamAdminGroup: Boolean(teamAdminGroup),
      });

      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team groups not found.',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: userId,
      },
    });

    const { teamRole: currentMemberToUpdateTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'Member',
        id: memberId,
      },
    });

    // Prevent admins from changing their own role.
    const isUpdatingSelfAsAdmin =
      currentMemberToUpdateTeamRole === TeamMemberRole.ADMIN &&
      team.organisation.members.some((organisationMember) => organisationMember.id === memberId) &&
      team.organisation.members.some(
        (organisationMember) => organisationMember.userId === userId,
      ) &&
      memberId ===
        team.organisation.members.find(
          (organisationMember) => organisationMember.userId === userId,
        )?.id;

    if (isUpdatingSelfAsAdmin) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Admins cannot change their own role.',
      });
    }

    // Check role permissions.
    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToUpdateTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member with a higher role',
      });
    }

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, data.role)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member to a role higher than your own',
      });
    }

    // Switch member to new internal team group role.
    await prisma.$transaction(async (tx) => {
      if (internalTeamGroupToRemoveMemberFrom) {
        await tx.organisationGroupMember.delete({
          where: {
            organisationMemberId_groupId: {
              organisationMemberId: memberId,
              groupId: internalTeamGroupToRemoveMemberFrom.organisationGroupId,
            },
          },
        });
      }

      await tx.organisationGroupMember.create({
        data: {
          id: generateDatabaseId('group_member'),
          organisationMemberId: memberId,
          groupId: match(data.role)
            .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
            .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
            .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
            .exhaustive(),
        },
      });
    });

    const organisationMember = await prisma.organisationMember.findUnique({
      where: {
        id: memberId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (organisationMember?.user) {
      await prisma.teamAuditLog.create({
        data: createTeamAuditLogData({
          teamId,
          type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ROLE_UPDATED,
          data: {
            memberUserId: organisationMember.user.id,
            memberEmail: organisationMember.user.email,
            previousRole: currentMemberToUpdateTeamRole,
            newRole: data.role,
          },
          user: {
            id: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name,
          },
          metadata: ctx.metadata,
        }),
      });
    }
  });
