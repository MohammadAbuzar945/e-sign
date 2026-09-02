import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { buildTeamWhereQuery } from '../../utils/teams';

type ResolveTeamFolderIdOptions = {
  folderId: string | null | undefined;
  userId: number;
  teamId: number;
  type: TFolderType;
};

/**
 * Resolves a folder ID for envelope operations.
 * Returns the folderId when it exists and belongs to the team, otherwise undefined (team root).
 */
export const resolveTeamFolderId = async ({
  folderId,
  userId,
  teamId,
  type,
}: ResolveTeamFolderIdOptions): Promise<string | undefined> => {
  if (!folderId) {
    return undefined;
  }

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      type,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
  });

  if (!folder) {
    return undefined;
  }

  return folderId;
};
