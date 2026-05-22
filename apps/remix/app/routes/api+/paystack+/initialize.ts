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
    //create subscription record in database
    const subscription = await prisma.subscription.create({
      data: {
        planId: validatedData.plan ?? '',
        priceId: validatedData.plan ?? '',
        customerId: validatedData.email,
        organisationId: validatedData.metadata?.organisationId as string,
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

