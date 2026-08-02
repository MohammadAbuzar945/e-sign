import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@documenso/prisma';

import { syncResellerSubaccountStatus } from './update-reseller-payout';

const getPaystackSubaccountMock = vi.fn();
const isPaystackSubaccountMissingErrorMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  getPaystackSubaccount: (...args: unknown[]) => getPaystackSubaccountMock(...args),
  isPaystackSubaccountMissingError: (...args: unknown[]) =>
    isPaystackSubaccountMissingErrorMock(...args),
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
    isPaystackSubaccountMissingErrorMock.mockReturnValue(false);
  });

  it('updates pending profile when Paystack reports the subaccount is verified', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      paystackSubaccountId: 123,
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
      subaccountFailureReason: null,
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

  it('re-checks Paystack even when local status is already ACTIVE', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      paystackSubaccountId: 123,
      subaccountStatus: 'ACTIVE',
      subaccountVerifiedAt: new Date('2026-07-13T00:00:00.000Z'),
      subaccountFailureReason: null,
    } as never);

    getPaystackSubaccountMock.mockResolvedValue({
      subaccount_code: 'ACCT_test',
      id: 123,
      is_verified: true,
      active: true,
    });

    const result = await syncResellerSubaccountStatus('org_1');

    expect(getPaystackSubaccountMock).toHaveBeenCalledWith('ACCT_test');
    expect(prismaMock.resellerProfile.update).not.toHaveBeenCalled();
    expect(result?.subaccountStatus).toBe('ACTIVE');
  });

  it('clears local subaccount when Paystack reports it missing', async () => {
    prismaMock.resellerProfile.findUnique.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_deleted',
      paystackSubaccountId: 99,
      subaccountStatus: 'ACTIVE',
      subaccountVerifiedAt: new Date('2026-07-13T00:00:00.000Z'),
      subaccountFailureReason: null,
    } as never);

    const missingError = new Error('Subaccount not found');
    getPaystackSubaccountMock.mockRejectedValue(missingError);
    isPaystackSubaccountMissingErrorMock.mockReturnValue(true);

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: null,
      paystackSubaccountId: null,
      subaccountStatus: 'FAILED',
      subaccountVerifiedAt: null,
      subaccountFailureReason: 'Paystack subaccount was not found',
    } as never);

    const result = await syncResellerSubaccountStatus('org_1');

    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paystackSubaccountCode: null,
          paystackSubaccountId: null,
          subaccountStatus: 'FAILED',
          subaccountVerifiedAt: null,
        }),
      }),
    );
    expect(result?.subaccountStatus).toBe('FAILED');
  });

  it('keeps pending profile unchanged when Paystack is still unverified', async () => {
    const profile = {
      id: 'profile_1',
      organisationId: 'org_1',
      paystackSubaccountCode: 'ACCT_test',
      paystackSubaccountId: 123,
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
      subaccountFailureReason: null,
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
