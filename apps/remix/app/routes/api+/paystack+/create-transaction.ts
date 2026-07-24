import { z } from 'zod';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  canAccessResellerCheckout,
  RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
} from '@documenso/lib/constants/demo-feature-flags';
import { createPendingOrganisationCreditPurchase } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

const createTransactionSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  plan: z.string().optional(),
  invoice_limit: z.number().optional(),
  callback_url: z.string().url().optional(),
  metadata: z
    .object({
      value: z.number().optional(),
      organisationId: z.string().optional(),
    })
    .optional(),
});

type CreateTransactionResponse = {
  success: boolean;
  data?: {
    authorization_url: string;
    reference: string;
  };
  error?: string;
};

export async function action({ request }: { request: Request }) {
  try {
    const { user } = await getSession(request);

    if (!canAccessResellerCheckout(user?.email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
        } satisfies CreateTransactionResponse),
        { status: 403 },
      );
    }

    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    const transactionData = {
      ...validatedData,
      metadata: validatedData.metadata,
    };

    const transaction = await createTransaction(transactionData);

    if (!transaction.status || !transaction.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: transaction.message || 'Failed to initialize transaction',
        } satisfies CreateTransactionResponse),
        { status: 500 },
      );
    }

    const organisationId = validatedData.metadata?.organisationId;
    const credits = validatedData.metadata?.value;

    if (
      typeof organisationId === 'string' &&
      organisationId.length > 0 &&
      typeof credits === 'number' &&
      credits > 0
    ) {
      const user = await prisma.user.findUnique({
        where: {
          email: validatedData.email,
        },
      });

      if (user) {
        await createPendingOrganisationCreditPurchase({
          paystackReference: transaction.data.reference,
          organisationId,
          userId: user.id,
          credits,
          grossAmount: validatedData.amount,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: transaction.data.authorization_url,
          reference: transaction.data.reference,
        },
      } satisfies CreateTransactionResponse),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request data',
        } satisfies CreateTransactionResponse),
        { status: 400 },
      );
    }

    console.error('Paystack transaction error:', error);

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
      statusCode =
        'status' in error.response && typeof error.response.status === 'number'
          ? error.response.status
          : 500;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      } satisfies CreateTransactionResponse),
      { status: statusCode },
    );
  }
}
