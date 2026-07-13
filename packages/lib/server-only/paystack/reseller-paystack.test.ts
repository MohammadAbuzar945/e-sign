import { describe, expect, it } from 'vitest';

import { AppError } from '@documenso/lib/errors/app-error';

import { resolvePaystackBankAccount } from './reseller-paystack';

describe('resolvePaystackBankAccount', () => {
  it('rejects South African bank lookup with a clear message', async () => {
    await expect(
      resolvePaystackBankAccount({
        accountNumber: '0123456047',
        bankCode: '198765',
        currency: 'ZAR',
      }),
    ).rejects.toThrow(AppError);

    await expect(
      resolvePaystackBankAccount({
        accountNumber: '0123456047',
        bankCode: '198765',
        currency: 'ZAR',
      }),
    ).rejects.toThrow('Enter the account holder name manually');
  });
});
