import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminRetryResellerSubaccount } from './admin-verify-reseller-bank';

const createPaystackSubaccountMock = vi.fn();
const updatePaystackSubaccountMock = vi.fn();
const getPaystackSubaccountMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  createPaystackSubaccount: (...args: unknown[]) => createPaystackSubaccountMock(...args),
  updatePaystackSubaccount: (...args: unknown[]) => updatePaystackSubaccountMock(...args),
  getPaystackSubaccount: (...args: unknown[]) => getPaystackSubaccountMock(...args),
}));

vi.mock('./reseller-secrets', () => ({
  decryptResellerSecret: (value: string) => value,
  maskBankAccountNumber: (value: string | null) => (value ? `****${value.slice(-4)}` : null),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    resellerApplication: {
      findUnique: vi.fn(),
    },
    resellerProfile: {
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock('./update-reseller-payout', () => ({
  syncResellerSubaccountStatus: vi.fn(),
}));

const prismaMock = vi.mocked(prisma);

describe('adminRetryResellerSubaccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Paystack subaccount without paid bank validation', async () => {
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      organisation: {
        name: 'Acme Org',
        resellerProfile: {
          id: 'profile_1',
          organisationId: 'org_1',
          status: 'ACTIVE',
          affiliateSlug: 'acme',
          bankCode: '632005',
          bankName: 'ABSA',
          bankAccountNumber: '0123456047',
          bankAccountName: 'Test Account',
          paystackSubaccountCode: null,
          platformFeePercent: 0,
        },
      },
    } as never);

    createPaystackSubaccountMock.mockResolvedValue({
      subaccount_code: 'ACCT_new',
      id: 99,
      is_verified: false,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({} as never);
    prismaMock.resellerProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile_1',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: '0123456047',
      bankAccountName: 'Test Account',
      paystackSubaccountCode: 'ACCT_new',
      subaccountStatus: 'PENDING',
    } as never);

    const result = await adminRetryResellerSubaccount({
      applicationId: 'app_1',
    });

    expect(createPaystackSubaccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '0123456047',
        settlementBank: '632005',
      }),
    );
    expect(result.subaccountStatus).toBe('PENDING');
    expect(result.paystackSubaccountCode).toBe('ACCT_new');
  });

  it('marks the profile failed when subaccount registration fails', async () => {
    prismaMock.resellerApplication.findUnique.mockResolvedValue({
      id: 'app_1',
      organisation: {
        name: 'Acme Org',
        resellerProfile: {
          id: 'profile_1',
          organisationId: 'org_1',
          status: 'ACTIVE',
          affiliateSlug: 'acme',
          bankCode: '632005',
          bankName: 'ABSA',
          bankAccountNumber: '0123456047',
          bankAccountName: 'Test Account',
          paystackSubaccountCode: null,
          platformFeePercent: 0,
        },
      },
    } as never);

    createPaystackSubaccountMock.mockRejectedValue(new Error('Invalid settlement bank'));

    prismaMock.resellerProfile.update.mockResolvedValue({} as never);

    await expect(
      adminRetryResellerSubaccount({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow(AppError);

    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subaccountStatus: 'FAILED',
          subaccountFailureReason: 'Invalid settlement bank',
        }),
      }),
    );
  });
});
