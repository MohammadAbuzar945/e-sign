import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@documenso/prisma';

import { buildPurchaseInvoiceHtml } from './build-purchase-invoice';
import {
  resolveBuyerBillingAddressForOrganisation,
  resolveBuyerVatNumberForOrganisation,
} from './get-organisation-purchase-history';

const prismaMock = vi.mocked(prisma);

describe('resolveBuyerVatNumberForOrganisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers VAT-registered reseller profile VAT over organisation VAT', async () => {
    vi.mocked(prismaMock.organisation.findUnique).mockResolvedValue({
      vatNumber: '4111111111',
      resellerProfile: {
        vatStatus: 'REGISTERED',
        vatNumber: '4222222222',
      },
    } as never);

    await expect(resolveBuyerVatNumberForOrganisation('org_1')).resolves.toBe('4222222222');
  });

  it('falls back to organisation VAT when buyer is not a registered reseller', async () => {
    vi.mocked(prismaMock.organisation.findUnique).mockResolvedValue({
      vatNumber: '4123456789',
      resellerProfile: null,
    } as never);

    await expect(resolveBuyerVatNumberForOrganisation('org_1')).resolves.toBe('4123456789');
  });

  it('returns null when neither reseller nor organisation VAT is set', async () => {
    vi.mocked(prismaMock.organisation.findUnique).mockResolvedValue({
      vatNumber: null,
      resellerProfile: {
        vatStatus: 'NOT_REGISTERED',
        vatNumber: null,
      },
    } as never);

    await expect(resolveBuyerVatNumberForOrganisation('org_1')).resolves.toBeNull();
  });
});

describe('resolveBuyerBillingAddressForOrganisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns trimmed organisation billing address', async () => {
    vi.mocked(prismaMock.organisation.findUnique).mockResolvedValue({
      billingAddress: '  1 Main Rd\nCape Town  ',
    } as never);

    await expect(resolveBuyerBillingAddressForOrganisation('org_1')).resolves.toBe(
      '1 Main Rd\nCape Town',
    );
  });

  it('returns null when billing address is empty', async () => {
    vi.mocked(prismaMock.organisation.findUnique).mockResolvedValue({
      billingAddress: '   ',
    } as never);

    await expect(resolveBuyerBillingAddressForOrganisation('org_1')).resolves.toBeNull();
  });
});

describe('buildPurchaseInvoiceHtml Bill to', () => {
  it('renders organisation VAT and billing address on Nomia invoices', () => {
    const html = buildPurchaseInvoiceHtml({
      invoice: {
        invoiceId: 'nomia_abc',
        invoiceNumber: 'NOM-20260715-001',
        purchaseGroupId: null,
        date: new Date('2026-08-01T12:00:00.000Z'),
        kind: 'pay_as_you_go',
        issuer: 'NOMIA',
        title: 'Pay as you go top-up',
        totalCredits: 100,
        totalGrossAmount: 11500,
        currency: 'ZAR',
        status: 'COMPLETED',
        buyerVatNumber: '4123456789',
        buyerBillingAddress: '10 Long Street\nCape Town\n8001',
        lineItems: [
          {
            provider: 'nomia',
            description: 'Pay as you go top-up',
            credits: 100,
            grossAmount: 11500,
            currency: 'ZAR',
            status: 'COMPLETED',
            reference: 'ref_1',
          },
        ],
      },
      organisationName: "Abuzar's Org",
      customerName: 'Abuzar',
      customerEmail: 'abuzar@example.com',
    });

    expect(html).toContain('Buyer VAT number — 4123456789');
    expect(html).toContain('10 Long Street<br />Cape Town<br />8001');
    expect(html).toContain("Abuzar's Org");
    expect(html).toContain('<strong>Invoice #</strong> NOM-20260715-001');
    expect(html).not.toContain('nomia_abc');
  });

  it('renders purchaser VAT and billing address on reseller invoices', () => {
    const html = buildPurchaseInvoiceHtml({
      invoice: {
        invoiceId: 'reseller_abc',
        invoiceNumber: 'RS-20260715-001',
        purchaseGroupId: null,
        date: new Date('2026-08-01T12:00:00.000Z'),
        kind: 'reseller',
        issuer: 'RESELLER',
        title: 'Credits from Acme Trading',
        totalCredits: 100,
        totalGrossAmount: 550000,
        currency: 'ZAR',
        status: 'COMPLETED',
        buyerVatNumber: '4123456789',
        buyerBillingAddress: '10 Long Street\nCape Town\n8001',
        resellerSeller: {
          name: 'Acme Trading',
          physicalAddress: '2 Seller Rd',
          vatStatus: 'REGISTERED',
          vatNumber: '4987654321',
          affiliateSlug: 'acme',
          hasLogo: false,
        },
        lineItems: [
          {
            provider: 'reseller',
            description: 'Credits from Acme Trading',
            credits: 100,
            grossAmount: 550000,
            currency: 'ZAR',
            status: 'COMPLETED',
            reference: 'ref_r1',
          },
        ],
      },
      organisationName: "Abuzar's Org",
      customerName: 'Abuzar',
      customerEmail: 'abuzar@example.com',
    });

    expect(html).toContain('Buyer VAT number — 4123456789');
    expect(html).toContain('10 Long Street<br />Cape Town<br />8001');
    expect(html).toContain('Acme Trading');
    expect(html).toContain('<strong>Invoice #</strong> RS-20260715-001');
    expect(html).not.toContain('reseller_abc');
  });
});
