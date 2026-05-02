import type { OrganisationGroup, OrganisationMemberRole } from '@prisma/client';
import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { TEAM_AUDIT_LOG_TYPE } from '../../types/team-audit-logs';
import { generateDatabaseId } from '../../universal/id';
import { createTeamAuditLogData } from '../../utils/team-audit-logs';

export type AcceptOrganisationInvitationOptions = {
  token: string;
};

export const acceptOrganisationInvitation = async ({
  token,
}: AcceptOrganisationInvitationOptions) => {
  const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
    where: {
      token,
      status: {
        not: OrganisationMemberInviteStatus.DECLINED,
      },
    },
    include: {
      organisation: {
        include: {
          groups: true,
        },
      },
    },
  });

  if (!organisationMemberInvite) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.ACCEPTED) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: organisationMemberInvite.email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User must exist to accept an organisation invitation',
    });
  }

  const { organisation } = organisationMemberInvite;

  const isUserPartOfOrganisation = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId: organisation.id,
    },
  });

  if (isUserPartOfOrganisation) {
    return;
  }

  await addUserToOrganisation({
    userId: user.id,
    organisationId: organisation.id,
    organisationGroups: organisation.groups,
    organisationMemberRole: organisationMemberInvite.organisationRole,
  });

  await prisma.organisationMemberInvite.update({
    where: {
      id: organisationMemberInvite.id,
    },
    data: {
      status: OrganisationMemberInviteStatus.ACCEPTED,
    },
  });

  const teams = await prisma.team.findMany({
    where: {
      organisationId: organisation.id,
      teamGroups: {
        some: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
            organisationRole: organisationMemberInvite.organisationRole,
          },
        },
      },
    },
  });

  if (teams.length > 0) {
    await (prisma as any).teamAuditLog.createMany({
      data: teams.flatMap((team) => [
        createTeamAuditLogData({
          teamId: team.id,
          type: TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_ACCEPTED,
          data: {
            email: organisationMemberInvite.email,
            organisationId: organisation.id,
          },
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        }),
        createTeamAuditLogData({
          teamId: team.id,
          type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_JOINED_VIA_ORG_INVITE,
          data: {
            memberUserId: user.id,
            memberEmail: user.email,
            organisationId: organisation.id,
          },
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        }),
      ]),
    });
  }
};

export const addUserToOrganisation = async ({
  userId,
  organisationId,
  organisationGroups,
  organisationMemberRole,
  bypassEmail = false,
}: {
  userId: number;
  organisationId: string;
  organisationGroups: OrganisationGroup[];
  organisationMemberRole: OrganisationMemberRole;
  bypassEmail?: boolean;
}) => {
  const organisationGroupToUse = organisationGroups.find(
    (group) =>
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationRole === organisationMemberRole,
  );

  if (!organisationGroupToUse) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Organisation group not found',
    });
  }

  await prisma.organisationMember.create({
    data: {
      id: generateDatabaseId('member'),
      userId,
      organisationId,
      organisationGroupMembers: {
        create: {
          id: generateDatabaseId('group_member'),
          groupId: organisationGroupToUse.id,
        },
      },
    },
  });

  if (!bypassEmail) {
    await jobs.triggerJob({
      name: 'send.organisation-member-joined.email',
      payload: {
        organisationId,
        memberUserId: userId,
      },
    });
  }
};
