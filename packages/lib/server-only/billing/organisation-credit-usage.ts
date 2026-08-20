import { prisma } from '@documenso/prisma';

type RecordOrganisationCreditUsageOptions = {
  organisationId: string;
  teamId: number;
  documentId: string;
  credits: number;
  tx?: Pick<typeof prisma, 'organisationCreditUsage'>;
};

export const recordOrganisationCreditUsage = ({
  organisationId,
  teamId,
  documentId,
  credits,
  tx = prisma,
}: RecordOrganisationCreditUsageOptions) => {
  return tx.organisationCreditUsage.create({
    data: {
      organisationId,
      teamId,
      documentId,
      credits,
    },
  });
};

export const getOrganisationCreditUsageTotal = async (organisationId: string) => {
  const result = await prisma.organisationCreditUsage.aggregate({
    where: {
      organisationId,
    },
    _sum: {
      credits: true,
    },
  });

  return result._sum.credits ?? 0;
};

export type OrganisationCreditUsageRow = {
  id: string;
  createdAt: Date;
  organisationId: string;
  teamId: number;
  teamName: string | null;
  documentId: string;
  credits: number;
};

export const findOrganisationCreditUsage = async (
  organisationId: string,
): Promise<OrganisationCreditUsageRow[]> => {
  const rows = await prisma.organisationCreditUsage.findMany({
    where: {
      organisationId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const teamIds = [...new Set(rows.map((row) => row.teamId))];

  const teams =
    teamIds.length === 0
      ? []
      : await prisma.team.findMany({
          where: {
            id: {
              in: teamIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        });

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    organisationId: row.organisationId,
    teamId: row.teamId,
    teamName: teamNameById.get(row.teamId) ?? null,
    documentId: row.documentId,
    credits: row.credits,
  }));
};
