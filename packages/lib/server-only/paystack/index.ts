import { Paystack } from 'paystack-sdk';

import { env } from '../../utils/env';

const webAppUrl = env('NEXT_PUBLIC_WEBAPP_URL');
const isProduction = webAppUrl?.includes('e-sign.nomiadocs.com');
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
  secretKey?: string;
  subaccount?: string;
  transaction_charge?: number;
  bearer?: 'account' | 'subaccount';
  split?: {
    type: 'flat' | 'percentage';
    bearer_type: 'account' | 'subaccount' | 'all' | 'all-proportional';
    subaccounts: Array<{
      subaccount: string;
      share: number;
    }>;
    bearer_subaccount?: string;
  };
}) {
  const { secretKey, subaccount, transaction_charge, bearer, split, ...rest } = options;
  const client = secretKey ? new Paystack(secretKey) : paystack;

  return client.transaction.initialize({
    ...rest,
    amount: rest.amount.toString(),
    ...(split
      ? { split }
      : subaccount
        ? {
            subaccount,
            ...(transaction_charge !== undefined ? { transaction_charge } : {}),
            ...(bearer ? { bearer } : {}),
          }
        : {}),
  });
}

export {
  createPaystackSubaccount,
  getNomiaPaystackSecretKey,
  getPaystackSubaccount,
  listPaystackBanks,
  resolvePaystackBankAccount,
  updatePaystackSubaccount,
  validatePaystackBankAccount,
} from './reseller-paystack';

export type {
  ValidatePaystackBankAccountOptions,
  ValidatePaystackBankAccountResult,
} from './reseller-paystack';

export type { ListPaystackBanksOptions, PaystackBankListItem } from './reseller-paystack';
