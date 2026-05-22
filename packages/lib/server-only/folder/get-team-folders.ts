import { prisma } from '@documenso/prisma';

export interface GetTeamFoldersOptions {
  teamId: number;
}

export const getTeamFolders = async ({ teamId }: GetTeamFoldersOptions) => {
  return await prisma.folder.findMany({
    where: {
      teamId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
};
