import { prisma } from '@documenso/prisma';

export interface GetTeamFoldersOptions {
  teamId: number;
}

export const getTeamFolders = async ({ teamId }: GetTeamFoldersOptions) => {
  const [team, folders] = await Promise.all([
    prisma.team.findUniqueOrThrow({
      where: {
        id: teamId,
      },
      select: {
        url: true,
      },
    }),
    prisma.folder.findMany({
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
    }),
  ]);

  return {
    teamUrl: team.url,
    folders,
  };
};
