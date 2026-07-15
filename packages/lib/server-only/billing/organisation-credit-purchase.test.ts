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

    await completeOrganisationCreditPurchase({
      paystackReference: 'ref_123',
      organisationId: 'org_1',
      userId: 42,
      credits: 50,
      grossAmount: 45000,
    });

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
});

describe('build-purchase-invoice', () => {
  it('includes the Nomia title-bar logo', async () => {
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
      logoUrl: 'https://sign.nomiadocs.com/static/logo.png',
    });

    expect(html).toContain(
      '<img class="brand-logo" src="https://sign.nomiadocs.com/static/logo.png" alt="Nomia" />',
    );
  });
});
