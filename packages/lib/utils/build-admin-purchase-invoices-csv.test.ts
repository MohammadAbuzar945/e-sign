import { describe, expect, it } from 'vitest';

import { buildAdminPurchaseInvoicesCsv } from './build-admin-purchase-invoices-csv';

describe('buildAdminPurchaseInvoicesCsv', () => {
  it('includes completed purchase columns and invoice id', () => {
    const csv = buildAdminPurchaseInvoicesCsv({
      rows: [
        {
          invoiceId: 'nomia_purchase_1',
          invoiceNumber: 'NOM-20260703-001',
          kind: 'BULK',
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          completedAt: new Date('2026-07-03T10:05:00.000Z'),
          credits: 2000,
          grossAmount: 1000000,
          currency: 'ZAR',
          pricePerCreditCents: 500,
          paystackReference: 'ref_123',
          organisationName: 'Acme Corp',
          organisationUrl: 'acme',
          purchaserName: 'Jane Buyer',
          purchaserEmail: 'jane@example.com',
          status: 'COMPLETED',
        },
      ],
    });

    expect(csv).toContain('Invoice Number');
    expect(csv).toContain('Internal ID');
    expect(csv).toContain('NOM-20260703-001');
    expect(csv).toContain('nomia_purchase_1');
    expect(csv).toContain('Bulk inventory');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('5.00');
    expect(csv).toContain('10000.00');
    expect(csv).toContain('COMPLETED');
  });

  it('includes subscription rows', () => {
    const csv = buildAdminPurchaseInvoicesCsv({
      rows: [
        {
          invoiceId: 'subscription_42',
          kind: 'SUBSCRIPTION',
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          completedAt: new Date('2026-07-03T10:05:00.000Z'),
          credits: 100,
          grossAmount: 49900,
          currency: 'ZAR',
          pricePerCreditCents: 499,
          paystackReference: 'plan_pro',
          organisationName: 'Acme Corp',
          organisationUrl: 'acme',
          purchaserName: 'Jane Buyer',
          purchaserEmail: 'jane@example.com',
          status: 'ACTIVE',
        },
      ],
    });

    expect(csv).toContain('subscription_42');
    expect(csv).toContain('Subscription');
    expect(csv).toContain('ACTIVE');
  });
});
