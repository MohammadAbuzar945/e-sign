import { OrganisationCreditPurchaseStatus, Prisma } from '@prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

export type FindResellerBulkPurchasesOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: OrganisationCreditPurchaseStatus;
};

export const findResellerBulkPurchases = async ({
  query = '',
  page = 1,
  perPage = 20,
  status,
}: FindResellerBulkPurchasesOptions) => {
  const whereClause: Prisma.OrganisationCreditPurchaseWhereInput = {
    purchaseType: 'BULK',
    status,
  };

  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    whereClause.OR = [
      { paystackReference: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive } },
      {
        organisation: {
          name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        organisation: {
          url: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        user: {
          email: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
      {
        user: {
          name: { contains: trimmedQuery, mode: Prisma.QueryMode.insensitive },
        },
      },
    ];
  }

  const [rows, count] = await Promise.all([
    prisma.organisationCreditPurchase.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        status: true,
        credits: true,
        grossAmount: true,
        currency: true,
        paystackReference: true,
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.organisationCreditPurchase.count({
      where: whereClause,
    }),
  ]);

  const data = rows.map((row) => ({
    ...row,
    pricePerCreditCents: row.credits > 0 ? Math.round(row.grossAmount / row.credits) : 0,
  }));

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
