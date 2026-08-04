import { describe, expect, it } from 'vitest';

import { NON_VAT_SUPPLIER_INVOICE_NOTE } from '@documenso/lib/constants/nomia-vat';
import { resolvePurchaseInvoicePolicy } from '@documenso/lib/server-only/billing/purchase-invoice-policy';
import {
  calculateVatBreakdownInCents,
  calculateResellerVatAmountInCents,
} from '@documenso/lib/utils/reseller-vat';

describe('VAT breakdown inclusive vs exclusive', () => {
  it('extracts VAT from inclusive gross for registered sellers', () => {
    expect(
      calculateVatBreakdownInCents({
        amountInCents: 45000,
        sellerVatStatus: 'REGISTERED',
        pricingMode: 'INCLUSIVE',
      }),
    ).toEqual({
      pricingMode: 'INCLUSIVE',
      vatRate: 0.15,
      netAmountInCents: 39130,
      vatAmountInCents: 5870,
      grossAmountInCents: 45000,
    });
  });

  it('adds VAT on exclusive net for registered sellers', () => {
    expect(
      calculateVatBreakdownInCents({
        amountInCents: 39130,
        sellerVatStatus: 'REGISTERED',
        pricingMode: 'EXCLUSIVE',
      }),
    ).toEqual({
      pricingMode: 'EXCLUSIVE',
      vatRate: 0.15,
      netAmountInCents: 39130,
      vatAmountInCents: 5870,
      grossAmountInCents: 45000,
    });
  });

  it('forces zero VAT for non-registered sellers even with a stray number', () => {
    expect(
      calculateResellerVatAmountInCents(45000, '4123456789', 'NOT_REGISTERED'),
    ).toBe(0);
  });
});

describe('purchase invoice policy', () => {
  it('issues Nomia tax invoices with VAT and optional buyer VAT', () => {
    const policy = resolvePurchaseInvoicePolicy({
      issuer: 'NOMIA',
      amountInCents: 11500,
      buyerVatNumber: '4123456789',
    });

    expect(policy.documentTitle).toBe('Tax Invoice');
    expect(policy.showVatColumns).toBe(true);
    expect(policy.vatAmountInCents).toBeGreaterThan(0);
    expect(policy.buyerVatNumber).toBe('4123456789');
    expect(policy.supplier.vatNumber).toBeTruthy();
  });

  it('issues reseller invoices without VAT for non-VAT sellers', () => {
    const policy = resolvePurchaseInvoicePolicy({
      issuer: 'RESELLER',
      amountInCents: 35000,
      sellerVatStatus: 'NOT_REGISTERED',
      resellerDisplayName: 'Acme Trading',
    });

    expect(policy.documentTitle).toBe('Invoice');
    expect(policy.showVatColumns).toBe(false);
    expect(policy.vatAmountInCents).toBe(0);
    expect(policy.requiredNote).toBe(NON_VAT_SUPPLIER_INVOICE_NOTE);
  });

  it('issues reseller tax invoices for VAT-registered sellers and keeps buyer VAT', () => {
    const policy = resolvePurchaseInvoicePolicy({
      issuer: 'RESELLER',
      amountInCents: 35000,
      sellerVatStatus: 'REGISTERED',
      sellerVatNumber: '4123456789',
      resellerDisplayName: 'Acme Trading',
      buyerVatNumber: '9999999999',
    });

    expect(policy.documentTitle).toBe('Tax Invoice');
    expect(policy.showVatColumns).toBe(true);
    expect(policy.supplier.vatNumber).toBe('4123456789');
    expect(policy.buyerVatNumber).toBe('9999999999');
  });
});
