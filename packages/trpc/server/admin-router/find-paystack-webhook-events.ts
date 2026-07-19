import { Prisma, type PaystackWebhookEventStatus } from '@prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZFindPaystackWebhookEventsRequestSchema,
  ZFindPaystackWebhookEventsResponseSchema,
} from './find-paystack-webhook-events.types';

export const findPaystackWebhookEventsRoute = adminProcedure
  .input(ZFindPaystackWebhookEventsRequestSchema)
  .output(ZFindPaystackWebhookEventsResponseSchema)
  .query(async ({ input }) => {
    const { query, page, perPage, status, event } = input;

    return await findPaystackWebhookEvents({
      query,
      page,
      perPage,
      status,
      event,
    });
  });

type FindPaystackWebhookEventsOptions = {
  query?: string;
  page?: number;
  perPage?: number;
  status?: PaystackWebhookEventStatus;
  event?: string;
};

export const findPaystackWebhookEvents = async ({
  query = '',
  page = 1,
  perPage = 20,
  status,
  event,
}: FindPaystackWebhookEventsOptions) => {
  const whereClause: Prisma.PaystackWebhookEventWhereInput = {
    status,
    event: event || undefined,
  };

  if (query) {
    whereClause.OR = [
      { id: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { reference: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { customerEmail: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { event: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { error: { contains: query, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  const [data, count] = await Promise.all([
    prisma.paystackWebhookEvent.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.paystackWebhookEvent.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
