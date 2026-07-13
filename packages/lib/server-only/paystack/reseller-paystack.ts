import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { Paystack } from 'paystack-sdk';

import { env } from '../../utils/env';

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    reference: string;
    access_code?: string;
  } | null;
};

type PaystackApiResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

const getNomiaPaystackSecretKey = () => {
  const webAppUrl = env('NEXT_PUBLIC_WEBAPP_URL');
  const isProduction = webAppUrl?.includes('e-sign.nomiadocs.com');
  const paystackKey = isProduction ? env('NEXT_PAYSTACK_LIVE_KEY') : env('NEXT_PAYSTACK_TEST_KEY');

  if (!paystackKey) {
    throw new Error('Paystack key is not set');
  }

  return paystackKey;
};

export const getNomiaPaystackClient = () => new Paystack(getNomiaPaystackSecretKey());

export const createPaystackClient = (secretKey: string) => new Paystack(secretKey);

const paystackFetch = async <T>(
  path: string,
  {
    method = 'GET',
    body,
    secretKey = getNomiaPaystackSecretKey(),
  }: {
    method?: 'GET' | 'POST' | 'PUT';
    body?: Record<string, unknown>;
    secretKey?: string;
  } = {},
): Promise<PaystackApiResponse<T>> => {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as PaystackApiResponse<T>;

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || `Paystack request failed (${response.status})`);
  }

  return payload;
};

export type CreateTransactionOptions = {
  email: string;
  amount: number;
  plan?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
  secretKey?: string;
  subaccount?: string;
  transaction_charge?: number;
  bearer?: 'account' | 'subaccount';
};

export const createTransaction = async ({
  secretKey,
  subaccount,
  transaction_charge,
  bearer,
  ...options
}: CreateTransactionOptions): Promise<PaystackInitializeResponse> => {
  const client = secretKey ? createPaystackClient(secretKey) : getNomiaPaystackClient();

  return client.transaction.initialize({
    ...options,
    amount: options.amount.toString(),
    ...(subaccount
      ? {
          subaccount,
          ...(transaction_charge !== undefined ? { transaction_charge } : {}),
          ...(bearer ? { bearer } : {}),
        }
      : {}),
  }) as Promise<PaystackInitializeResponse>;
};

export type PaystackBank = {
  name: string;
  code: string;
  active: boolean;
  country: string;
  currency: string;
  type: string;
};

export const listPaystackBanks = async (country = 'south africa') => {
  const result = await paystackFetch<PaystackBank[]>(
    `/bank?country=${encodeURIComponent(country)}&perPage=100`,
  );

  return result.data.filter((bank) => bank.active);
};

export type ResolvePaystackBankAccountOptions = {
  accountNumber: string;
  bankCode: string;
  currency?: string;
};

const SOUTH_AFRICAN_BANK_LOOKUP_MESSAGE =
  'Account name lookup is not available for South African banks. Enter the account holder name manually.';

export const resolvePaystackBankAccount = async ({
  accountNumber,
  bankCode,
  currency,
}: ResolvePaystackBankAccountOptions) => {
  let resolvedCurrency = currency?.toUpperCase();

  if (!resolvedCurrency) {
    const banks = await listPaystackBanks('south africa');
    const bank = banks.find((item) => item.code === bankCode);
    resolvedCurrency = bank?.currency?.toUpperCase();
  }

  if (resolvedCurrency === 'ZAR') {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: SOUTH_AFRICAN_BANK_LOOKUP_MESSAGE,
    });
  }

  const supportedResolveCurrencies = ['NGN', 'USD', 'GHS', 'KES', 'ZAR'] as const;
  const currencyParam: (typeof supportedResolveCurrencies)[number] =
    resolvedCurrency &&
    supportedResolveCurrencies.includes(
      resolvedCurrency as (typeof supportedResolveCurrencies)[number],
    )
      ? (resolvedCurrency as (typeof supportedResolveCurrencies)[number])
      : 'ZAR';

  const result = await paystackFetch<{
    account_number: string;
    account_name: string;
    bank_id: number;
  }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}&currency=${encodeURIComponent(currencyParam)}`,
  );

  return result.data;
};

export type CreatePaystackSubaccountOptions = {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  percentageCharge?: number;
  description?: string;
};

export const createPaystackSubaccount = async ({
  businessName,
  settlementBank,
  accountNumber,
  percentageCharge = 0,
  description,
}: CreatePaystackSubaccountOptions) => {
  const result = await paystackFetch<{
    subaccount_code: string;
    id: number;
    is_verified?: boolean;
  }>('/subaccount', {
    method: 'POST',
    body: {
      business_name: businessName,
      settlement_bank: settlementBank,
      account_number: accountNumber,
      percentage_charge: percentageCharge,
      description,
    },
  });

  return result.data;
};

export type UpdatePaystackSubaccountOptions = {
  subaccountCode: string;
  businessName?: string;
  settlementBank?: string;
  accountNumber?: string;
  percentageCharge?: number;
  description?: string;
};

export const updatePaystackSubaccount = async ({
  subaccountCode,
  businessName,
  settlementBank,
  accountNumber,
  percentageCharge,
  description,
}: UpdatePaystackSubaccountOptions) => {
  const result = await paystackFetch<{
    subaccount_code: string;
    id: number;
    is_verified?: boolean;
  }>(`/subaccount/${encodeURIComponent(subaccountCode)}`, {
    method: 'PUT',
    body: {
      ...(businessName ? { business_name: businessName } : {}),
      ...(settlementBank ? { settlement_bank: settlementBank } : {}),
      ...(accountNumber ? { account_number: accountNumber } : {}),
      ...(percentageCharge !== undefined ? { percentage_charge: percentageCharge } : {}),
      ...(description ? { description } : {}),
    },
  });

  return result.data;
};

export type PaystackSubaccountDetails = {
  subaccount_code: string;
  id: number;
  is_verified?: boolean;
  active?: boolean;
};

export const getPaystackSubaccount = async (subaccountCode: string) => {
  const result = await paystackFetch<PaystackSubaccountDetails>(
    `/subaccount/${encodeURIComponent(subaccountCode)}`,
  );

  return result.data;
};

export { getNomiaPaystackSecretKey };
