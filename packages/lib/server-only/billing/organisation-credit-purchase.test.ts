import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  organisationCreditPurchase: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  subscription: {
    findMany: vi.fn(),
  },
  resellerCreditTransaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@documenso/lib/server-only/subscription/get-subscriptions-by-user-id', () => ({
  getSubscriptionsByUserId: vi.fn().mockResolvedValue([]),
}));

describe('record-organisation-credit-purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending pay-as-you-go purchase when checkout starts', async () => {
    const { createPendingOrganisationCreditPurchase } = await import(
      './record-organisation-credit-purchase'
    );

    prismaMock.organisationCreditPurchase.upsert.mockResolvedValue({
      id: 'purchase_1',
      status: 'PENDING',
    });

    await createPendingOrganisationCreditPurchase({
      paystackReference: 'ref_123',
      organisationId: 'org_1',
      userId: 42,
      credits: 50,
      grossAmount: 45000,
    });

    expect(prismaMock.organisationCreditPurchase.upsert).toHaveBeenCalledWith({
      where: { paystackReference: 'ref_123' },
      create: expect.objectContaining({
        credits: 50,
        grossAmount: 45000,
        status: 'PENDING',
      }),
      update: expect.objectContaining({
        credits: 50,
        grossAmount: 45000,
        status: 'PENDING',
      }),
    });
  });

  it('marks an existing pending purchase as completed in the webhook', async () => {
    const { completeOrganisationCreditPurchase } = await import(
      './record-organisation-credit-purchase'
    );

    prismaMock.organisationCreditPurchase.findUnique.mockResolvedValue({
      id: 'purchase_1',
      status: 'PENDING',
    });

    prismaMock.organisationCreditPurchase.update.mockResolvedValue({
      id: 'purchase_1',
      status: 'COMPLETED',
    });

    const result = await completeOrganisationCreditPurchase({
      paystackReference: 'ref_123',
      organisationId: 'org_1',
      userId: 42,
      credits: 50,
      grossAmount: 45000,
    });

    expect(result.isNewlyCompleted).toBe(true);
    expect(prismaMock.organisationCreditPurchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase_1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        credits: 50,
        grossAmount: 45000,
      }),
    });
  });
});

describe('get-organisation-purchase-history pay-as-you-go', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes pay-as-you-go purchases in billing history', async () => {
    const { getOrganisationPurchaseHistory } = await import('./get-organisation-purchase-history');

    prismaMock.organisationCreditPurchase.findMany.mockResolvedValue([
      {
        id: 'purchase_1',
        completedAt: new Date('2026-07-12T10:00:00.000Z'),
        createdAt: new Date('2026-07-12T09:55:00.000Z'),
        credits: 50,
        grossAmount: 45000,
        currency: 'ZAR',
        status: 'COMPLETED',
        paystackReference: 'ref_123',
      },
    ]);
    prismaMock.resellerCreditTransaction.findMany.mockResolvedValue([]);

    const history = await getOrganisationPurchaseHistory({ organisationId: 'org_1' });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      kind: 'pay_as_you_go',
      totalCredits: 50,
      totalGrossAmount: 45000,
      invoiceId: 'nomia_purchase_1',
      lineItems: [
        expect.objectContaining({
          provider: 'nomia',
          credits: 50,
          grossAmount: 45000,
          reference: 'ref_123',
        }),
      ],
    });
  });

  it('keeps a grouped Nomia-only purchase labeled as Nomia', async () => {
    const { getOrganisationPurchaseHistory } = await import('./get-organisation-purchase-history');

    prismaMock.organisationCreditPurchase.findMany.mockResolvedValue([
      {
        id: 'purchase_grouped',
        purchaseGroupId: 'pur_nomia_only',
        completedAt: new Date('2026-07-15T10:00:00.000Z'),
        createdAt: new Date('2026-07-15T09:55:00.000Z'),
        credits: 1000,
        grossAmount: 100000,
        currency: 'ZAR',
        status: 'COMPLETED',
        paystackReference: 'ref_nomia_only',
      },
    ]);
    prismaMock.resellerCreditTransaction.findMany.mockResolvedValue([]);

    const history = await getOrganisationPurchaseHistory({ organisationId: 'org_1' });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      invoiceId: 'pur_nomia_only',
      kind: 'pay_as_you_go',
      title: 'Pay as you go top-up (Nomia)',
      totalCredits: 1000,
    });
  });

  it('includes standalone reseller purchases in billing history', async () => {
    const { getOrganisationPurchaseHistory } = await import('./get-organisation-purchase-history');

    prismaMock.organisationCreditPurchase.findMany.mockResolvedValue([]);
    prismaMock.resellerCreditTransaction.findMany.mockResolvedValue([
      {
        id: 'reseller_tx_1',
        purchaseGroupId: null,
        completedAt: new Date('2026-07-16T10:00:00.000Z'),
        createdAt: new Date('2026-07-16T09:55:00.000Z'),
        credits: 50,
        grossAmount: 35000,
        currency: 'ZAR',
        status: 'COMPLETED',
        paystackReference: 'ref_reseller_1',
        package: {
          creditAmount: 50,
          catalogPackageId: 'payg-50',
        },
        resellerProfile: {
          affiliateSlug: 'acme',
          brandingEnabled: false,
          brandingLogo: null,
          brandingCompanyDetails: 'Acme Trading',
          physicalAddress: '1 Main Street',
          vatStatus: 'REGISTERED',
          vatNumber: '4123456789',
          organisation: {
            name: 'Acme Org',
          },
        },
      },
    ]);

    const history = await getOrganisationPurchaseHistory({ organisationId: 'org_1' });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      kind: 'reseller',
      invoiceId: 'reseller_reseller_tx_1',
      totalCredits: 50,
      totalGrossAmount: 35000,
      resellerSeller: expect.objectContaining({
        affiliateSlug: 'acme',
        name: 'Acme Trading',
      }),
    });
  });
});

describe('build-purchase-invoice', () => {
  it('includes the Nomia logo and A4 page styles', async () => {
    const { buildPurchaseInvoiceHtml } = await import('./build-purchase-invoice');

    const html = buildPurchaseInvoiceHtml({
      invoice: {
        invoiceId: 'invoice_1',
        purchaseGroupId: null,
        date: new Date('2026-07-15T10:00:00.000Z'),
        kind: 'pay_as_you_go',
        title: 'Pay as you go top-up',
        totalCredits: 100,
        totalGrossAmount: 10000,
        currency: 'ZAR',
        status: 'COMPLETED',
        lineItems: [],
      },
      organisationName: 'Buyer Org',
      customerName: 'Buyer',
      customerEmail: 'buyer@example.com',
      logoUrl: 'https://sign.nomiadocs.com/android-chrome-512x512.png',
    });

    expect(html).toContain(
      'src="https://sign.nomiadocs.com/android-chrome-512x512.png" alt="Nomia"',
    );
    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
  });

  it('includes reseller VAT and physical address on reseller invoices', async () => {
    const { buildPurchaseInvoiceHtml } = await import('./build-purchase-invoice');

    const html = buildPurchaseInvoiceHtml({
      invoice: {
        invoiceId: 'reseller_1',
        purchaseGroupId: null,
        date: new Date('2026-07-15T10:00:00.000Z'),
        kind: 'reseller',
        title: 'Credits from Acme Trading',
        totalCredits: 50,
        totalGrossAmount: 35000,
        currency: 'ZAR',
        status: 'COMPLETED',
        resellerSeller: {
          name: 'Acme Trading',
          physicalAddress: '1 Main Street\nJohannesburg\n2000',
          vatStatus: 'REGISTERED',
          vatNumber: '4123456789',
          affiliateSlug: 'acme',
          hasLogo: true,
        },
        lineItems: [
          {
            provider: 'reseller',
            description: 'Credits from Acme Trading',
            credits: 50,
            grossAmount: 35000,
            currency: 'ZAR',
            status: 'COMPLETED',
            reference: 'ref_1',
          },
        ],
      },
      organisationName: 'Buyer Org',
      customerName: 'Buyer',
      customerEmail: 'buyer@example.com',
      resellerLogoUrl: 'data:image/png;base64,resellerlogo',
    });

    expect(html).toContain('Reseller (seller)');
    expect(html).toContain('Acme Trading');
    expect(html).toContain('1 Main Street');
    expect(html).toContain('VAT registered — 4123456789');
    expect(html).toContain('Issued via Nomia on behalf of Acme Trading');
    expect(html).toContain('data:image/png;base64,resellerlogo');
    expect(html).toContain('seller-logo');
  });
});
