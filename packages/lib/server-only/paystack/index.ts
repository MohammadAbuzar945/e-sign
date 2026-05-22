import { Paystack } from 'paystack-sdk';
import { any } from 'zod';

import { env } from '../../utils/env';



// if WEBAPP_URL is localhost, use the test key
// else use the live key

const webAppUrl = env('NEXT_PUBLIC_WEBAPP_URL');
const isProduction   = webAppUrl?.includes('e-sign.nomiadocs.com');
const paystackKey = isProduction ? env('NEXT_PAYSTACK_LIVE_KEY') : env('NEXT_PAYSTACK_TEST_KEY');
if (!paystackKey) {
  throw new Error('Paystack key is not set');
}

const paystack = new Paystack(paystackKey);


export { paystack };

interface PaystackResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    reference: string;
  } | null;
}

export async function initializeTransaction(options: {
  email: string;
  amount: number;
  plan?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResponse> {
  return paystack.transaction.initialize({
    ...options,
    amount: options.amount.toString(),
  });
}

export async function verifyTransaction(reference: string) {
  return paystack.transaction.verify(reference);
}
export async function disableSubscription(subscriptionCode: string) {
  return paystack.subscription.disable({
    code: subscriptionCode,
    token: '',
  });
}

export async function manageSubscription(subscriptionCode: string) {
  return paystack.subscription.generateSubscriptionLink(subscriptionCode);
}

export async function createTransaction(options: {
  email: string;
  amount: number;
  plan?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}) {
  return paystack.transaction.initialize({
    ...options,
    amount: options.amount.toString(),
  });
}
