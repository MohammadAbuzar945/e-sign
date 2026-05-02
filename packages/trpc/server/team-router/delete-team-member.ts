import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberRoles } from '@documenso/lib/server-only/team/get-member-roles';
import { TEAM_AUDIT_LOG_TYPE } from '@documenso/lib/types/team-audit-logs';
import { buildTeamWhereQuery, isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { createTeamAuditLogData } from '@documenso/lib/utils/team-audit-logs';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteTeamMemberRequestSchema,
  ZDeleteTeamMemberResponseSchema,
} from './delete-team-member.types';

export const deleteTeamMemberRoute = authenticatedProcedure
  // .meta(deleteTeamMemberMeta)
  .input(ZDeleteTeamMemberRequestSchema)
  .output(ZDeleteTeamMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, memberId } = input;
    const { user } = ctx;

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
            userId: user.id,
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
          select: {
            ownerUserId: true,
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
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    if (team.teamGroups.length === 0) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Team has no internal team groups',
      });
    }

    const { teamRole: currentUserTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    const { teamRole: currentMemberToDeleteTeamRole } = await getMemberRoles({
      teamId,
      reference: {
        type: 'Member',
        id: memberId,
      },
    });

    const internalTeamGroupToRemoveMemberFrom = team.teamGroups.find((group) =>
      group.organisationGroup.organisationGroupMembers.some(
        (groupMember) => groupMember.organisationMember.id === memberId,
      ),
    );

    if (!internalTeamGroupToRemoveMemberFrom) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message:
          'This member cannot be removed directly because their access is granted via an organisation group. Remove them from the group (or detach the group from the team) instead.',
      });
    }

    const organisationMemberToDelete =
      internalTeamGroupToRemoveMemberFrom.organisationGroup.organisationGroupMembers.find(
        (groupMember) => groupMember.organisationMember.id === memberId,
      )?.organisationMember;

    // Prevent admins from removing themselves from the team.
    if (
      organisationMemberToDelete?.userId === user.id &&
      currentMemberToDeleteTeamRole === TeamMemberRole.ADMIN
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Admins cannot remove themselves from the team.',
      });
    }

    // Check role permissions.
    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, currentMemberToDeleteTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot remove a member with a higher role',
      });
    }

    const removedMember =
      teamGroupToRemoveMemberFrom.organisationGroup.organisationGroupMembers.find(
        (ogm) => ogm.organisationMember.id === memberId,
      );

    if (!removedMember) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Member not found in this team',
      });
    }

    await prisma.$transaction(async (tx) => {
      // Removing a user from a single team drops their INTERNAL_TEAM
      // OrganisationGroupMember link, but Envelope rows they authored in this
      // team still point at their userId. Reassign to the org owner so those
      // envelopes remain reachable after the member loses team access.
      await tx.envelope.updateMany({
        where: {
          userId: removedMember.organisationMember.userId,
          teamId,
        },
        data: {
          userId: team.organisation.ownerUserId,
        },
      });

      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: memberId,
            groupId: internalTeamGroupToRemoveMemberFrom.organisationGroupId,
          },
        },
      });
    });

    if (organisationMemberToDelete) {
      const memberUser = await prisma.user.findUnique({
        where: {
          id: organisationMemberToDelete.userId,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (memberUser) {
        await prisma.teamAuditLog.create({
          data: createTeamAuditLogData({
            teamId,
            type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_REMOVED,
            data: {
              memberUserId: memberUser.id,
              memberEmail: memberUser.email,
              previousRole: currentMemberToDeleteTeamRole,
            },
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            metadata: ctx.metadata,
          }),
        });
      }
    }
  });
