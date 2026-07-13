import { describe, expect, it } from 'vitest';

import { getResellerPayoutReadiness } from './reseller-payout-readiness';

describe('getResellerPayoutReadiness', () => {
  it('requires Paystack keys for OWN_PAYSTACK mode', () => {
    expect(
      getResellerPayoutReadiness({
        payoutMode: 'OWN_PAYSTACK',
        paystackPublicKey: null,
        paystackSecretKey: null,
        paystackSubaccountCode: null,
        subaccountStatus: null,
      }),
    ).toEqual(
      expect.objectContaining({
        canAcceptPayments: false,
        blockingReason: 'Paystack public and secret keys are required',
      }),
    );
  });

  it('accepts OWN_PAYSTACK when keys are present', () => {
    expect(
      getResellerPayoutReadiness({
        payoutMode: 'OWN_PAYSTACK',
        paystackPublicKey: 'pk_test',
        paystackSecretKey: 'sk_test',
        paystackSubaccountCode: null,
        subaccountStatus: null,
      }).canAcceptPayments,
    ).toBe(true);
  });

  it('requires active subaccount for NOMIA_SUBACCOUNT mode', () => {
    expect(
      getResellerPayoutReadiness({
        payoutMode: 'NOMIA_SUBACCOUNT',
        paystackPublicKey: null,
        paystackSecretKey: null,
        paystackSubaccountCode: 'ACCT_1',
        subaccountStatus: 'PENDING',
      }),
    ).toEqual(
      expect.objectContaining({
        canAcceptPayments: false,
        blockingReason: 'Bank account verification is still pending',
      }),
    );

    expect(
      getResellerPayoutReadiness({
        payoutMode: 'NOMIA_SUBACCOUNT',
        paystackPublicKey: null,
        paystackSecretKey: null,
        paystackSubaccountCode: 'ACCT_1',
        subaccountStatus: 'ACTIVE',
      }).canAcceptPayments,
    ).toBe(true);
  });
});
