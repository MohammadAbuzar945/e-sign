import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import { ZPaystackWebhookEventSchema } from './find-paystack-webhook-events.types';

export const ZGetPaystackWebhookEventRequestSchema = z.object({
  id: z.string().min(1),
});

export const ZGetPaystackWebhookEventResponseSchema = ZPaystackWebhookEventSchema;

export const getPaystackWebhookEventRoute = adminProcedure
  .input(ZGetPaystackWebhookEventRequestSchema)
  .output(ZGetPaystackWebhookEventResponseSchema)
  .query(async ({ input }) => {
    const { id } = input;

    const webhookEvent = await prisma.paystackWebhookEvent.findUnique({
      where: { id },
    });

    if (!webhookEvent) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Paystack webhook event not found',
      });
    }

    return webhookEvent;
  });
