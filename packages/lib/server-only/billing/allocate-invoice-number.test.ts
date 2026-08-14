import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

describe('allocate-invoice-number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats UTC date keys and padded sequences', async () => {
    const { formatInvoiceDateKeyUtc, formatSequentialInvoiceNumber } = await import(
      './allocate-invoice-number'
    );

    expect(formatInvoiceDateKeyUtc(new Date('2026-08-12T23:30:00.000Z'))).toBe('20260812');
    expect(
      formatSequentialInvoiceNumber({
        prefix: 'NOM',
        dateKey: '20260812',
        sequence: 1,
      }),
    ).toBe('NOM-20260812-001');
    expect(
      formatSequentialInvoiceNumber({
        prefix: 'RS',
        dateKey: '20260812',
        sequence: 12,
      }),
    ).toBe('RS-20260812-012');
  });

  it('shares one continuous platform sequence across Nomia, resellers, and days', async () => {
    const { allocateNomiaInvoiceNumber, allocateResellerInvoiceNumber } = await import(
      './allocate-invoice-number'
    );

    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ nextValue: 11 }])
      .mockResolvedValueOnce([{ nextValue: 12 }])
      .mockResolvedValueOnce([{ nextValue: 13 }]);

    await expect(
      allocateNomiaInvoiceNumber({ issuedAt: new Date('2026-08-06T10:00:00.000Z') }),
    ).resolves.toBe('NOM-20260806-011');

    await expect(
      allocateResellerInvoiceNumber({
        resellerOrganisationId: 'org_reseller_a',
        issuedAt: new Date('2026-08-08T10:00:00.000Z'),
      }),
    ).resolves.toBe('RS-20260808-012');

    await expect(
      allocateResellerInvoiceNumber({
        resellerOrganisationId: 'org_reseller_b',
        issuedAt: new Date('2026-08-14T10:00:00.000Z'),
      }),
    ).resolves.toBe('RS-20260814-013');

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('falls back to an em dash when display number is missing', async () => {
    const { resolveDisplayInvoiceNumber } = await import('./allocate-invoice-number');

    expect(resolveDisplayInvoiceNumber(null)).toBe('—');
    expect(resolveDisplayInvoiceNumber('')).toBe('—');
    expect(resolveDisplayInvoiceNumber('NOM-20260812-001')).toBe('NOM-20260812-001');
  });
});
