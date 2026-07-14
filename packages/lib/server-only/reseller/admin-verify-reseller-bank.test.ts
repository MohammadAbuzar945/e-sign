import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminVerifyResellerBankAccount } from './admin-verify-reseller-bank';

const validatePaystackBankAccountMock = vi.fn();
const createPaystackSubaccountMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  validatePaystackBankAccount: (...args: unknown[]) => validatePaystackBankAccountMock(...args),
  createPaystackSubaccount: (...args: unknown[]) => createPaystackSubaccountMock(...args),
  updatePaystackSubaccount: vi.fn(),
  getPaystackSubaccount: vi.fn(),
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
    },
  },
}));

const prismaMock = vi.mocked(prisma);

describe('adminVerifyResellerBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Paystack validate and activates the subaccount when verified', async () => {
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
          bankAccountType: 'personal',
          bankDocumentType: 'identityNumber',
          bankDocumentNumber: '9001015800088',
          paystackSubaccountCode: null,
          platformFeePercent: 0,
        },
      },
    } as never);

    validatePaystackBankAccountMock.mockResolvedValue({
      verified: true,
      accountHolderMatch: true,
      verificationMessage: 'Account is verified successfully',
    });

    createPaystackSubaccountMock.mockResolvedValue({
      subaccount_code: 'ACCT_new',
      id: 99,
      is_verified: false,
    });

    prismaMock.resellerProfile.update.mockResolvedValue({
      id: 'profile_1',
      bankCode: '632005',
      bankName: 'ABSA',
      bankAccountNumber: '0123456047',
      bankAccountName: 'Test Account',
      paystackSubaccountCode: 'ACCT_new',
      subaccountStatus: 'ACTIVE',
    } as never);

    const result = await adminVerifyResellerBankAccount({
      applicationId: 'app_1',
    });

    expect(validatePaystackBankAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '0123456047',
        bankCode: '632005',
        countryCode: 'ZA',
        documentNumber: '9001015800088',
      }),
    );
    expect(createPaystackSubaccountMock).toHaveBeenCalled();
    expect(result.validationFeeZar).toBe(3);
    expect(result.subaccountStatus).toBe('ACTIVE');
  });

  it('marks the profile failed when Paystack validation rejects the account', async () => {
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
          bankAccountType: 'personal',
          bankDocumentType: 'identityNumber',
          bankDocumentNumber: '9001015800088',
          paystackSubaccountCode: null,
          platformFeePercent: 0,
        },
      },
    } as never);

    validatePaystackBankAccountMock.mockResolvedValue({
      verified: false,
      verificationMessage: 'Account holder mismatch',
    });

    prismaMock.resellerProfile.update.mockResolvedValue({} as never);

    await expect(
      adminVerifyResellerBankAccount({
        applicationId: 'app_1',
      }),
    ).rejects.toThrow(AppError);

    expect(prismaMock.resellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subaccountStatus: 'FAILED',
          subaccountFailureReason: 'Account holder mismatch',
        }),
      }),
    );
  });
});
