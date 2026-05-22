/////////////////////////////////////////////////////////////////////////////////////////////
//
// Be aware that any changes to this file may require migrations since we are storing JSON
// data in Prisma.
//
/////////////////////////////////////////////////////////////////////////////////////////////
import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import type { TTeamAuditLog } from '../types/team-audit-logs';
import { TEAM_AUDIT_LOG_TYPE, ZTeamAuditLogSchema } from '../types/team-audit-logs';
import type {
  ApiRequestMetadata,
  RequestMetadata,
} from '../universal/extract-request-metadata';

type CreateTeamAuditLogDataOptions<T = TTeamAuditLog['type']> = {
  teamId: number;
  type: T;
  data: Extract<TTeamAuditLog, { type: T }>['data'];
  user?: { email?: string | null; id?: number | null; name?: string | null } | null;
  requestMetadata?: RequestMetadata;
  metadata?: ApiRequestMetadata;
};

export type CreateTeamAuditLogDataResponse = {
  type: TTeamAuditLog['type'];
  teamId: number;
  createdAt?: Date;
  name?: string | null;
  email?: string | null;
  userId?: number | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  data: TTeamAuditLog['data'];
};

export const createTeamAuditLogData = <T extends TTeamAuditLog['type']>({
  teamId,
  type,
  data,
  user,
  requestMetadata,
  metadata,
}: CreateTeamAuditLogDataOptions<T>): CreateTeamAuditLogDataResponse => {
  let userId: number | null = metadata?.auditUser?.id || null;
  let email: string | null = metadata?.auditUser?.email || null;
  let name: string | null = metadata?.auditUser?.name || null;

  if (user) {
    if (user.id !== undefined && user.id !== null) {
      userId = user.id;
    }

    if (user.email !== undefined && user.email !== null) {
      email = user.email;
    }

    if (user.name !== undefined && user.name !== null) {
      name = user.name;
    }
  }

  const ipAddress = metadata?.requestMetadata.ipAddress ?? requestMetadata?.ipAddress ?? null;
  const userAgent = metadata?.requestMetadata.userAgent ?? requestMetadata?.userAgent ?? null;

  return {
    type,
    data,
    teamId,
    userId,
    email,
    name,
    userAgent,
    ipAddress,
  };
};

export const parseTeamAuditLogData = (auditLog: unknown): TTeamAuditLog => {
  const data = ZTeamAuditLogSchema.safeParse(auditLog);

  if (!data.success) {
    // Todo: Alert us.
    console.error(data.error);
    throw new Error('Migration required');
  }

  return data.data;
};

const getOrganisationGroupLabel = (
  i18n: I18n,
  organisationGroupName?: string | null,
  organisationGroupId?: string | null,
) => {
  if (organisationGroupName && organisationGroupName.trim().length > 0) {
    return organisationGroupName;
  }

  if (organisationGroupId && organisationGroupId.startsWith('org_group_')) {
    return i18n._(
      msg({
        message: `an internal group`,
        context: `Team audit log format`,
      }),
    );
  }

  return organisationGroupId ?? '';
};

export const formatTeamAuditLogAction = (
  i18n: I18n,
  auditLog: TTeamAuditLog,
  userId?: number,
) => {
  const prefix =
    userId === auditLog.userId ? i18n._(msg`You`) : auditLog.name || auditLog.email || '';

  const description = match(auditLog)
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_CREATED }, ({ data }) => ({
      anonymous: msg({
        message: `Team created`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} created team ${data.teamName}`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ADDED }, ({ data }) => ({
      anonymous: msg({
        message: `Team member added`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} added ${data.memberEmail} as ${data.teamRole.toLowerCase()}`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_REMOVED }, ({ data }) => ({
      anonymous: msg({
        message: `Team member removed`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} removed ${data.memberEmail} from the team`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ROLE_UPDATED }, ({ data }) => ({
      anonymous: msg({
        message: `Team member role updated`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} changed ${data.memberEmail}'s role from ${data.previousRole.toLowerCase()} to ${data.newRole.toLowerCase()}`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_JOINED_VIA_ORG_INVITE }, ({ data }) => ({
      anonymous: msg({
        message: `Team member joined via organisation invite`,
        context: `Team audit log format`,
      }),
      identified: msg`${data.memberEmail} joined the team via organisation invite`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ATTACHED }, ({ data }) => ({
      anonymous: msg({
        message: `Team group attached`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} attached group ${getOrganisationGroupLabel(i18n, data.organisationGroupName, data.organisationGroupId)} as ${data.teamRole.toLowerCase()}`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_DETACHED }, ({ data }) => ({
      anonymous: msg({
        message: `Team group detached`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} detached group ${getOrganisationGroupLabel(i18n, data.organisationGroupName, data.organisationGroupId)} from the team`,
    }))
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ROLE_UPDATED }, ({ data }) => ({
      anonymous: msg({
        message: `Team group role updated`,
        context: `Team audit log format`,
      }),
      identified: msg`${prefix} changed group ${getOrganisationGroupLabel(i18n, data.organisationGroupName, data.organisationGroupId)} role from ${data.previousRole.toLowerCase()} to ${data.newRole.toLowerCase()}`,
    }))
    .with(
      { type: TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITED },
      ({ data }) => ({
        anonymous: msg({
          message: `Organisation member invited`,
          context: `Team audit log format`,
        }),
        identified: msg`${prefix} invited ${data.email} to the organisation`,
      }),
    )
    .with(
      { type: TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_ACCEPTED },
      ({ data }) => ({
        anonymous: msg({
          message: `Organisation invite accepted`,
          context: `Team audit log format`,
        }),
        identified: msg`${data.email} accepted the organisation invitation`,
      }),
    )
    .with(
      { type: TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_DECLINED },
      ({ data }) => ({
        anonymous: msg({
          message: `Organisation invite declined`,
          context: `Team audit log format`,
        }),
        identified: msg`${data.email} declined the organisation invitation`,
      }),
    )
    .with({ type: TEAM_AUDIT_LOG_TYPE.TEAM_VISIBILITY_UPDATED }, ({ data }) => ({
      anonymous: msg({
        message: `Team visibility updated`,
        context: `Team audit log format`,
      }),
      identified:
        data.newIsPrivate === true
          ? msg`${prefix} made the team private`
          : msg`${prefix} made the team public`,
    }))
    .exhaustive();

  return {
    prefix,
    description: i18n._(prefix ? description.identified : description.anonymous),
  };
};

