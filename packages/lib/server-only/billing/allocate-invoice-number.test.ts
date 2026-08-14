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

  it('shares one continuous platform sequence across Nomia and resellers', async () => {
    const { allocateNomiaInvoiceNumber, allocateResellerInvoiceNumber } = await import(
      './allocate-invoice-number'
    );

    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ nextValue: 1 }])
      .mockResolvedValueOnce([{ nextValue: 2 }])
      .mockResolvedValueOnce([{ nextValue: 3 }]);

    await expect(
      allocateNomiaInvoiceNumber({ issuedAt: new Date('2026-08-12T10:00:00.000Z') }),
    ).resolves.toBe('NOM-20260812-001');

    await expect(
      allocateResellerInvoiceNumber({
        resellerOrganisationId: 'org_reseller_a',
        issuedAt: new Date('2026-08-12T11:00:00.000Z'),
      }),
    ).resolves.toBe('RS-20260812-002');

    await expect(
      allocateResellerInvoiceNumber({
        resellerOrganisationId: 'org_reseller_b',
        issuedAt: new Date('2026-08-13T09:00:00.000Z'),
      }),
    ).resolves.toBe('RS-20260813-003');

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('falls back to an em dash when display number is missing', async () => {
    const { resolveDisplayInvoiceNumber } = await import('./allocate-invoice-number');

    expect(resolveDisplayInvoiceNumber(null)).toBe('—');
    expect(resolveDisplayInvoiceNumber('')).toBe('—');
    expect(resolveDisplayInvoiceNumber('NOM-20260812-001')).toBe('NOM-20260812-001');
  });
});
