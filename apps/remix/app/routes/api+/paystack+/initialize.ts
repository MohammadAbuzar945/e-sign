import { z } from 'zod';

import { initializeTransaction } from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';
// import { SubscriptionStatus } from '@documenso/prisma/generated/zod/inputTypeSchemas/SubscriptionStatusSchema';

const initializeTransactionSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  plan: z.string().optional(),
  callback_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const validatedData = initializeTransactionSchema.parse(body);

    const transaction = await initializeTransaction(validatedData);

    if (!transaction.status || !transaction.data) {
      return new Response(
        JSON.stringify({
          error: transaction.message || 'Failed to initialize transaction',
        }),
        { status: 500 },
      );
    }


    console.log('Transaction data:', transaction.data);

    const organisationId = validatedData.metadata?.organisationId;

    if (typeof organisationId !== 'string' || organisationId.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'organisationId is required in metadata',
        }),
        { status: 400 },
      );
    }

    const paystackReference = transaction.data.reference;
    const planCode = validatedData.plan ?? '';

    // planId must be globally unique (Stripe subscription id / Paystack subscription_code).
    // Until Paystack returns a subscription_code, use the checkout reference as a temporary id.
    const existingPendingSubscription = await prisma.subscription.findFirst({
      where: {
        organisationId,
        priceId: planCode,
        status: 'PAST_DUE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const subscription = existingPendingSubscription
      ? await prisma.subscription.update({
          where: { id: existingPendingSubscription.id },
          data: {
            planId: paystackReference,
            priceId: planCode,
            customerId: validatedData.email,
          },
        })
      : await prisma.subscription.create({
          data: {
            planId: paystackReference,
            priceId: planCode,
            customerId: validatedData.email,
            organisationId,
            status: 'PAST_DUE',
          },
        });

    console.log('Subscription created:', subscription);

    return new Response(
      JSON.stringify({
        authorization_url: transaction.data.authorization_url,
        reference: transaction.data.reference,
      }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
        }),
        { status: 400 },
      );
    }

    console.error('Paystack initialize error:', error);

    // Extract Paystack error message from AxiosError
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'data' in error.response &&
      error.response.data &&
      typeof error.response.data === 'object' &&
      'message' in error.response.data
    ) {
      errorMessage = String(error.response.data.message);
      statusCode = 'status' in error.response && typeof error.response.status === 'number' 
        ? error.response.status 
        : 500;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      { status: statusCode },
    );
  }
}

