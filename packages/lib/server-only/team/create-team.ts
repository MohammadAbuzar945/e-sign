import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberRole, Prisma, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { LOWEST_ORGANISATION_ROLE, ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { TEAM_INTERNAL_GROUPS } from '../../constants/teams';
import { TEAM_AUDIT_LOG_TYPE } from '../../types/team-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { generateDatabaseId } from '../../universal/id';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { createTeamAuditLogData } from '../../utils/team-audit-logs';
import { generateDefaultTeamSettings } from '../../utils/teams';

export type CreateTeamOptions = {
  /**
   * ID of the user creating the Team.
   */
  userId: number;

  /**
   * Name of the team to display.
   */
  teamName: string;

  /**
   * Unique URL of the team.
   *
   * Used as the URL path, example: https://documenso.com/t/{teamUrl}/settings
   */
  teamUrl: string;

  /**
   * ID of the organisation the team belongs to.
   */
  organisationId: string;

  /**
   * Whether to inherit all members from the organisation.
   */
  inheritMembers: boolean;

  /**
   * Whether only members of the team can see documents belonging to this team.
   */
  isPrivate: boolean;

  /**
   * ID of the organisation member who should be added as the initial team admin
   * when creating a private team.
   */
  organisationMemberId?: string;

  /**
   * List of additional groups to attach to the team.
   */
  groups?: {
    id: string;
    role: TeamMemberRole;
  }[];

  /**
   * Request metadata for audit logging.
   */
  metadata?: ApiRequestMetadata;
};

export const createTeam = async ({
  userId,
  teamName,
  teamUrl,
  organisationId,
  inheritMembers,
  isPrivate,
  organisationMemberId,
  metadata,
}: CreateTeamOptions) => {
  const organisationSuffix = organisationId.slice(-5);
  const organisationScopedTeamUrl = `${organisationSuffix}-${teamUrl}`;

  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      groups: true,
      organisationClaim: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found.',
    });
  }

  const existingTeamWithNameInOrganisation = await prisma.team.findFirst({
    where: {
      organisationId,
      name: teamName,
    },
  });

  if (existingTeamWithNameInOrganisation) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'Team name already exists in this organisation.',
    });
  }

  // Validate they have enough team slots. 0 means they can create unlimited teams.
  if (organisation.organisationClaim.teamCount !== 0) {
    const teamCount = await prisma.team.count({
      where: {
        organisationId,
      },
    });

    if (teamCount >= organisation.organisationClaim.teamCount) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached the maximum number of teams for your plan.',
      });
    }
  }

  // Inherit internal organisation groups to the team for non-private teams.
  // Organisation Admins/Mangers get assigned as team admins, members get assigned as team members.
  // For private teams we do not attach any organisation groups so that only explicitly added members
  // have access to the team.
  const internalOrganisationGroups = isPrivate
    ? []
    : organisation.groups
        .filter((group) => {
          if (group.type !== OrganisationGroupType.INTERNAL_ORGANISATION) {
            return false;
          }

          // If we're inheriting members, allow all internal organisation groups.
          if (inheritMembers) {
            return true;
          }

          // Otherwise, only inherit organisation admins/managers.
          return (
            group.organisationRole === OrganisationMemberRole.ADMIN ||
            group.organisationRole === OrganisationMemberRole.MANAGER
          );
        })
        .map((group) =>
          match(group.organisationRole)
            .with(OrganisationMemberRole.ADMIN, OrganisationMemberRole.MANAGER, () => ({
              organisationGroupId: group.id,
              teamRole: TeamMemberRole.ADMIN,
            }))
            .with(OrganisationMemberRole.MEMBER, () => ({
              organisationGroupId: group.id,
              teamRole: TeamMemberRole.MEMBER,
            }))
            .exhaustive(),
        );

  await prisma
    .$transaction(
      async (tx) => {
        const teamSettings = await tx.teamGlobalSettings.create({
          data: {
            ...generateDefaultTeamSettings(),
            defaultRecipients: Prisma.DbNull,
            id: generateDatabaseId('team_setting'),
          },
        });

        const team = await tx.team.create({
          data: {
            name: teamName,
            url: organisationScopedTeamUrl,
            organisationId,
            isPrivate,
            teamGlobalSettingsId: teamSettings.id,
            teamGroups: {
              createMany: {
                // Attach the internal organisation groups to the team.
                data: internalOrganisationGroups.map((group) => ({
                  ...group,
                  id: generateDatabaseId('team_group'),
                })),
              },
            },
          },
          include: {
            teamGroups: true,
          },
        });

        // Create the internal team groups.
        const internalTeamGroups = await Promise.all(
          TEAM_INTERNAL_GROUPS.map(async (teamGroup) =>
            tx.organisationGroup.create({
              data: {
                id: generateDatabaseId('org_group'),
                type: teamGroup.type,
                organisationRole: LOWEST_ORGANISATION_ROLE,
                organisationId,
                teamGroups: {
                  create: {
                    id: generateDatabaseId('team_group'),
                    teamId: team.id,
                    teamRole: teamGroup.teamRole,
                  },
                },
              },
              include: {
                teamGroups: true,
              },
            }),
          ),
        );

        // Prepare audit logs for team creation and initial members.
        const auditLogs: ReturnType<typeof createTeamAuditLogData>[] = [];

        const teamCreatedLog = createTeamAuditLogData({
          teamId: team.id,
          type: TEAM_AUDIT_LOG_TYPE.TEAM_CREATED,
          data: {
            teamId: team.id,
            teamName: team.name,
            organisationId,
            isPrivate,
            createdByUserId: userId,
          },
          user: {
            id: userId,
          },
          metadata,
        });

        auditLogs.push({
          ...teamCreatedLog,
          createdAt: team.createdAt,
        });

        // For private teams, add only the specified admin as a member and do not
        // automatically attach any organisation groups or additional members.
        if (isPrivate) {
          if (!organisationMemberId) {
            throw new AppError(AppErrorCode.INVALID_BODY, {
              message: 'Organisation member is required when creating a private team.',
            });
          }

          const organisationMember = await tx.organisationMember.findFirst({
            where: {
              organisationId,
              id: organisationMemberId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          });

          if (!organisationMember) {
            throw new AppError(AppErrorCode.INVALID_BODY, {
              message: 'Organisation member must belong to the current organisation.',
            });
          }

          const adminTeamGroup = internalTeamGroups
            .flatMap((group) => group.teamGroups)
            .find((group) => group.teamId === team.id && group.teamRole === TeamMemberRole.ADMIN);

          if (!adminTeamGroup) {
            throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
              message: 'Internal admin team group not found when creating private team.',
            });
          }

          await tx.organisationGroupMember.create({
            data: {
              id: generateDatabaseId('group_member'),
              organisationMemberId: organisationMember.id,
              groupId: adminTeamGroup.organisationGroupId,
            },
          });

          // Log that the initial admin was added to the private team.
          if (organisationMember.user.email) {
            const initialAdminLog = createTeamAuditLogData({
              teamId: team.id,
              type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ADDED,
              data: {
                memberUserId: organisationMember.user.id,
                memberEmail: organisationMember.user.email,
                teamRole: TeamMemberRole.ADMIN,
                source: 'MANUAL',
              },
              user: {
                id: userId,
              },
              metadata,
            });

            auditLogs.push({
              ...initialAdminLog,
              // Ensure this appears after the TEAM_CREATED log when sorted by time.
              createdAt: new Date(team.createdAt.getTime() + 1000),
            });
          }
        }

        if (auditLogs.length > 0) {
          await (tx as any).teamAuditLog.createMany({
            data: auditLogs,
          });
        }
      },
      {
        timeout: 7500,
      },
    )
    .catch((err) => {
      if (err.code === 'P2002') {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Team URL already exists',
        });
      }

      throw err;
    });
};
