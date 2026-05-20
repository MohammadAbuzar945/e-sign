import { DocumentVisibility, OrganisationGroupType, TeamMemberRole } from '@prisma/client';

export const TEAM_URL_ROOT_REGEX = /^\/t\/[^/]+\/?$/;
export const TEAM_URL_REGEX = /^\/t\/[^/]+/;

export const LOWEST_TEAM_ROLE = TeamMemberRole.MEMBER;

export const ALLOWED_TEAM_GROUP_TYPES: OrganisationGroupType[] = [
  OrganisationGroupType.CUSTOM,
  OrganisationGroupType.INTERNAL_ORGANISATION,
];

export const TEAM_INTERNAL_GROUPS: {
  teamRole: TeamMemberRole;
  type: OrganisationGroupType;
}[] = [
  {
    teamRole: TeamMemberRole.ADMIN,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
  {
    teamRole: TeamMemberRole.MANAGER,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
  {
    teamRole: TeamMemberRole.MEMBER,
    type: OrganisationGroupType.INTERNAL_TEAM,
  },
] as const;

export const TEAM_MEMBER_ROLE_PERMISSIONS_MAP = {
  DELETE_TEAM: [TeamMemberRole.ADMIN],
  MANAGE_TEAM: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
} satisfies Record<string, TeamMemberRole[]>;

export const TEAM_DOCUMENT_VISIBILITY_MAP = {
  [TeamMemberRole.ADMIN]: [DocumentVisibility.ADMIN, DocumentVisibility.MANAGER_AND_ABOVE, DocumentVisibility.EVERYONE],
  [TeamMemberRole.MANAGER]: [DocumentVisibility.MANAGER_AND_ABOVE, DocumentVisibility.EVERYONE],
  [TeamMemberRole.MEMBER]: [DocumentVisibility.EVERYONE],
} satisfies Record<TeamMemberRole, DocumentVisibility[]>;

/**
 * A hierarchy of team member roles to determine which role has higher permission than another.
 *
 * Warning: The length of the array is used to determine the priority of the role.
 * See `getHighestTeamRoleInGroup`
 */
export const TEAM_MEMBER_ROLE_HIERARCHY = {
  [TeamMemberRole.ADMIN]: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER, TeamMemberRole.MEMBER],
  [TeamMemberRole.MANAGER]: [TeamMemberRole.MANAGER, TeamMemberRole.MEMBER],
  [TeamMemberRole.MEMBER]: [TeamMemberRole.MEMBER],
} satisfies Record<TeamMemberRole, TeamMemberRole[]>;
