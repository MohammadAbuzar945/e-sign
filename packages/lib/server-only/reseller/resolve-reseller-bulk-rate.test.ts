import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerProfile: {
      findUnique: vi.fn(),
    },
    resellerBulkRateTier: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@documenso/prisma';

import {
  matchBulkRateTier,
  resolveResellerBulkRate,
} from './resolve-reseller-bulk-rate';

describe('matchBulkRateTier', () => {
  const tiers = [
    { minCredits: 500, pricePerCreditCents: 600, isEnabled: true },
    { minCredits: 2000, pricePerCreditCents: 500, isEnabled: true },
    { minCredits: 5000, pricePerCreditCents: 400, isEnabled: true },
  ];

  it('matches the highest eligible tier', () => {
    expect(matchBulkRateTier({ credits: 500, tiers })?.pricePerCreditCents).toBe(600);
    expect(matchBulkRateTier({ credits: 1999, tiers })?.pricePerCreditCents).toBe(600);
    expect(matchBulkRateTier({ credits: 2000, tiers })?.pricePerCreditCents).toBe(500);
    expect(matchBulkRateTier({ credits: 5000, tiers })?.pricePerCreditCents).toBe(400);
  });

  it('returns null below the minimum tier', () => {
    expect(matchBulkRateTier({ credits: 499, tiers })).toBeNull();
  });

  it('ignores disabled tiers', () => {
    expect(
      matchBulkRateTier({
        credits: 5000,
        tiers: [
          ...tiers.slice(0, 2),
          { minCredits: 5000, pricePerCreditCents: 400, isEnabled: false },
        ],
      })?.pricePerCreditCents,
    ).toBe(500);
  });
});

describe('resolveResellerBulkRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses custom tiers when enabled', async () => {
    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp_1',
      status: 'ACTIVE',
      bulkRatesUseCustom: true,
      bulkRatesIncludeGlobal: false,
      bulkRateTiers: [
        { minCredits: 1000, pricePerCreditCents: 450, isEnabled: true },
      ],
    } as never);

    const result = await resolveResellerBulkRate({
      organisationId: 'org_1',
      credits: 1000,
    });

    expect(result.source).toBe('CUSTOM');
    expect(result.amountInCents).toBe(450000);
    expect(result.ratePerCreditCents).toBe(450);
  });

  it('falls back to global tiers when custom is off', async () => {
    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp_1',
      status: 'ACTIVE',
      bulkRatesUseCustom: false,
      bulkRatesIncludeGlobal: false,
      bulkRateTiers: [],
    } as never);

    vi.mocked(prisma.resellerBulkRateTier.findMany).mockResolvedValue([
      { minCredits: 500, pricePerCreditCents: 600, isEnabled: true },
    ] as never);

    const result = await resolveResellerBulkRate({
      organisationId: 'org_1',
      credits: 500,
    });

    expect(result.source).toBe('GLOBAL');
    expect(result.amountInCents).toBe(300000);
  });

  it('merges custom and global tiers when include-global is on', async () => {
    vi.mocked(prisma.resellerProfile.findUnique).mockResolvedValue({
      id: 'rp_1',
      status: 'ACTIVE',
      bulkRatesUseCustom: true,
      bulkRatesIncludeGlobal: true,
      bulkRateTiers: [{ minCredits: 1000, pricePerCreditCents: 450, isEnabled: true }],
    } as never);

    vi.mocked(prisma.resellerBulkRateTier.findMany).mockResolvedValue([
      { minCredits: 500, pricePerCreditCents: 600, isEnabled: true },
      { minCredits: 1000, pricePerCreditCents: 550, isEnabled: true },
    ] as never);

    const result = await resolveResellerBulkRate({
      organisationId: 'org_1',
      credits: 500,
    });

    expect(result.source).toBe('MERGED');
    expect(result.ratePerCreditCents).toBe(600);
    expect(result.tiers).toEqual([
      { minCredits: 500, pricePerCreditCents: 600 },
      { minCredits: 1000, pricePerCreditCents: 450 },
    ]);
  });
});
