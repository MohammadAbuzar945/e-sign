import type { Prisma } from '@prisma/client';
import { PaystackWebhookEventStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

type PaystackWebhookPayload = {
  event: string;
  data?: Record<string, unknown>;
};

const extractReference = (data?: Record<string, unknown>): string | null => {
  if (!data) {
    return null;
  }

  if (typeof data.reference === 'string' && data.reference.length > 0) {
    return data.reference;
  }

  if (typeof data.subscription_code === 'string' && data.subscription_code.length > 0) {
    return data.subscription_code;
  }

  return null;
};

const extractCustomerEmail = (data?: Record<string, unknown>): string | null => {
  if (!data) {
    return null;
  }

  const customer = data.customer;

  if (customer && typeof customer === 'object' && 'email' in customer) {
    const email = (customer as { email?: unknown }).email;

    if (typeof email === 'string' && email.length > 0) {
      return email;
    }
  }

  return null;
};

export const createPaystackWebhookEvent = async (payload: PaystackWebhookPayload) => {
  return await prisma.paystackWebhookEvent.create({
    data: {
      event: payload.event,
      status: PaystackWebhookEventStatus.PENDING,
      payload: payload as Prisma.InputJsonValue,
      reference: extractReference(payload.data),
      customerEmail: extractCustomerEmail(payload.data),
    },
  });
};

export const finalizePaystackWebhookEvent = async ({
  id,
  status,
  result,
  error,
}: {
  id: string;
  status: PaystackWebhookEventStatus;
  result?: Prisma.InputJsonValue;
  error?: string | null;
}) => {
  return await prisma.paystackWebhookEvent.update({
    where: { id },
    data: {
      status,
      result: result ?? undefined,
      error: error ?? null,
      processedAt: new Date(),
    },
  });
};
