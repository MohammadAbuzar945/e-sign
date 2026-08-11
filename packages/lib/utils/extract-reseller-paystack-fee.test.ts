import { describe, expect, it } from 'vitest';

import { extractResellerSubaccountPaystackFeeInCents } from './extract-reseller-paystack-fee';

describe('extractResellerSubaccountPaystackFeeInCents', () => {
  it('reads fees_split.paystack for pure reseller subaccount charges', () => {
    const fee = extractResellerSubaccountPaystackFeeInCents(
      {
        fees: 12622,
        fees_split: {
          params: {
            bearer: 'subaccount',
            percentage_charge: '0',
            transaction_charge: '',
          },
          paystack: 12622,
          subaccount: 362378,
          integration: 0,
        },
        split: {},
      } as never,
      'ACCT_2mmt39qrc44myrc',
    );

    expect(fee).toBe(12622);
  });

  it('reads the matching subaccount fee from hybrid split shares', () => {
    const fee = extractResellerSubaccountPaystackFeeInCents(
      {
        fees: 23460,
        fees_split: null,
        split: {
          shares: {
            fees: 11730,
            paystack: 23460,
            integration: 408270,
            subaccounts: [
              {
                id: 2035079,
                fees: 11730,
                amount: 268270,
                original_share: 280000,
                subaccount_code: 'ACCT_2mmt39qrc44myrc',
              },
            ],
            original_share: 420000,
          },
        },
      },
      'ACCT_2mmt39qrc44myrc',
    );

    expect(fee).toBe(11730);
  });

  it('does not use the full hybrid fee when the subaccount share is missing', () => {
    const fee = extractResellerSubaccountPaystackFeeInCents(
      {
        fees: 23460,
        split: {
          shares: {
            subaccounts: [
              {
                fees: 11730,
                subaccount_code: 'ACCT_other',
              },
            ],
          },
        },
      },
      'ACCT_2mmt39qrc44myrc',
    );

    expect(fee).toBe(0);
  });

  it('returns zero when the main account bears fees_split charges', () => {
    const fee = extractResellerSubaccountPaystackFeeInCents({
      fees: 12622,
      fees_split: {
        params: { bearer: 'account' },
        paystack: 12622,
      },
    });

    expect(fee).toBe(0);
  });
});
