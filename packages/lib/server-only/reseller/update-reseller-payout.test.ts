import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { syncResellerSubaccountStatus } from './update-reseller-payout';

const getPaystackSubaccountMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  getPaystackSubaccount: (...args: unknown[]) => getPaystackSubaccountMock(...args),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaMock = vi.mocked(prisma);

describe('syncResellerSubaccountStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates pending profile when Paystack reports the subaccount is verified', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    } as never);

    getPaystackSubaccountMock.mockResolvedValue({
      subaccount_code: 'ACCT_test',
      id: 123,
      is_verified: true,
      active: true,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      subaccountStatus: 'ACTIVE',
      subaccountVerifiedAt: new Date('2026-07-13T00:00:00.000Z'),
    } as never);

    const result = await syncResellerSubaccountStatus('org_1');

    expect(getPaystackSubaccountMock).toHaveBeenCalledWith('ACCT_test');
    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org_1' },
        data: expect.objectContaining({
          subaccountStatus: 'ACTIVE',
        }),
      }),
    );
    expect(result?.subaccountStatus).toBe('ACTIVE');
  });

  it('keeps pending profile unchanged when Paystack is still unverified', async () => {
    const profile = {
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    };

    prismaMock.resellerProfile.findUnique.mockResolvedValue(profile as never);
    getPaystackSubaccountMock.mockResolvedValue({
      subaccount_code: 'ACCT_test',
      id: 123,
      is_verified: false,
      active: true,
    });

    const result = await syncResellerSubaccountStatus('org_1');

    expect(prismaMock.resellerProfile.update).not.toHaveBeenCalled();
    expect(result).toEqual(profile);
  });
});
