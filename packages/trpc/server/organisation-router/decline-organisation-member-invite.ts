import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { TEAM_AUDIT_LOG_TYPE } from '@documenso/lib/types/team-audit-logs';
import { createTeamAuditLogData } from '@documenso/lib/utils/team-audit-logs';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';
import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZDeclineOrganisationMemberInviteRequestSchema,
  ZDeclineOrganisationMemberInviteResponseSchema,
} from './decline-organisation-member-invite.types';

export const declineOrganisationMemberInviteRoute = maybeAuthenticatedProcedure
  .input(ZDeclineOrganisationMemberInviteRequestSchema)
  .output(ZDeclineOrganisationMemberInviteResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token } = input;

    const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
      where: {
        token,
      },
    });

    if (!organisationMemberInvite) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });

    const teams = await prisma.team.findMany({
      where: {
        organisationId: organisationMemberInvite.organisationId,
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
        data: teams.map((team) =>
          createTeamAuditLogData({
            teamId: team.id,
            type: TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_DECLINED,
            data: {
              email: organisationMemberInvite.email,
              organisationId: organisationMemberInvite.organisationId,
            },
            user: ctx.user
              ? {
                  id: ctx.user.id,
                  email: ctx.user.email,
                  name: ctx.user.name,
                }
              : {
                  id: null,
                  email: organisationMemberInvite.email,
                  name: null,
                },
            metadata: ctx.metadata,
          }),
        ),
      });
    }

    // TODO: notify the team owner
  });
