import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

export const ZTeamAuditLogTypeSchema = z.enum([
  'TEAM_CREATED',
  'TEAM_MEMBER_ADDED',
  'TEAM_MEMBER_REMOVED',
  'TEAM_MEMBER_ROLE_UPDATED',
  'TEAM_MEMBER_JOINED_VIA_ORG_INVITE',
  'TEAM_GROUP_ATTACHED',
  'TEAM_GROUP_DETACHED',
  'TEAM_GROUP_ROLE_UPDATED',
  'ORGANISATION_MEMBER_INVITED',
  'ORGANISATION_MEMBER_INVITE_ACCEPTED',
  'ORGANISATION_MEMBER_INVITE_DECLINED',
  'TEAM_VISIBILITY_UPDATED',
]);

export const TEAM_AUDIT_LOG_TYPE = ZTeamAuditLogTypeSchema.Enum;

const ZBaseMemberSchema = z.object({
  memberUserId: z.number().nullable().optional(),
  memberEmail: z.string(),
});

export const ZTeamAuditLogEventTeamCreatedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_CREATED),
  data: z.object({
    teamId: z.number(),
    teamName: z.string(),
    organisationId: z.string(),
    isPrivate: z.boolean(),
    createdByUserId: z.number().nullable().optional(),
  }),
});

export const ZTeamAuditLogEventTeamVisibilityUpdatedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_VISIBILITY_UPDATED),
  data: z.object({
    previousIsPrivate: z.boolean(),
    newIsPrivate: z.boolean(),
  }),
});

export const ZTeamAuditLogEventMemberAddedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ADDED),
  data: ZBaseMemberSchema.extend({
    teamRole: z.nativeEnum(TeamMemberRole),
    source: z.enum(['MANUAL', 'ORG_INHERIT']).optional(),
  }),
});

export const ZTeamAuditLogEventMemberRemovedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_REMOVED),
  data: ZBaseMemberSchema.extend({
    previousRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZTeamAuditLogEventMemberRoleUpdatedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_ROLE_UPDATED),
  data: ZBaseMemberSchema.extend({
    previousRole: z.nativeEnum(TeamMemberRole),
    newRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZTeamAuditLogEventMemberJoinedViaOrgInviteSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_MEMBER_JOINED_VIA_ORG_INVITE),
  data: ZBaseMemberSchema.extend({
    organisationId: z.string(),
  }),
});

export const ZTeamAuditLogEventTeamGroupAttachedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ATTACHED),
  data: z.object({
    organisationGroupId: z.string(),
    organisationGroupName: z.string().nullable().optional(),
    teamRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZTeamAuditLogEventTeamGroupDetachedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_DETACHED),
  data: z.object({
    organisationGroupId: z.string(),
    organisationGroupName: z.string().nullable().optional(),
    teamRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZTeamAuditLogEventTeamGroupRoleUpdatedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.TEAM_GROUP_ROLE_UPDATED),
  data: z.object({
    organisationGroupId: z.string(),
    organisationGroupName: z.string().nullable().optional(),
    previousRole: z.nativeEnum(TeamMemberRole),
    newRole: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZTeamAuditLogEventOrganisationMemberInvitedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITED),
  data: z.object({
    email: z.string().email(),
    organisationId: z.string(),
    inviterUserId: z.number().nullable().optional(),
  }),
});

export const ZTeamAuditLogEventOrganisationMemberInviteAcceptedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_ACCEPTED),
  data: z.object({
    email: z.string().email(),
    organisationId: z.string(),
  }),
});

export const ZTeamAuditLogEventOrganisationMemberInviteDeclinedSchema = z.object({
  type: z.literal(TEAM_AUDIT_LOG_TYPE.ORGANISATION_MEMBER_INVITE_DECLINED),
  data: z.object({
    email: z.string().email(),
    organisationId: z.string(),
  }),
});

export const ZTeamAuditLogBaseSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  teamId: z.number(),
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  userId: z.number().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
});

export const ZTeamAuditLogSchema = ZTeamAuditLogBaseSchema.and(
  z.union([
    ZTeamAuditLogEventTeamCreatedSchema,
    ZTeamAuditLogEventMemberAddedSchema,
    ZTeamAuditLogEventMemberRemovedSchema,
    ZTeamAuditLogEventMemberRoleUpdatedSchema,
    ZTeamAuditLogEventMemberJoinedViaOrgInviteSchema,
    ZTeamAuditLogEventTeamGroupAttachedSchema,
    ZTeamAuditLogEventTeamGroupDetachedSchema,
    ZTeamAuditLogEventTeamGroupRoleUpdatedSchema,
    ZTeamAuditLogEventOrganisationMemberInvitedSchema,
    ZTeamAuditLogEventOrganisationMemberInviteAcceptedSchema,
    ZTeamAuditLogEventOrganisationMemberInviteDeclinedSchema,
    ZTeamAuditLogEventTeamVisibilityUpdatedSchema,
  ]),
);

export type TTeamAuditLog = z.infer<typeof ZTeamAuditLogSchema>;
export type TTeamAuditLogType = z.infer<typeof ZTeamAuditLogTypeSchema>;

export type TeamAuditLogByType<T = TTeamAuditLog['type']> = Extract<
  TTeamAuditLog,
  { type: T }
>;

export type TTeamAuditLogBaseSchema = z.infer<typeof ZTeamAuditLogBaseSchema>;

