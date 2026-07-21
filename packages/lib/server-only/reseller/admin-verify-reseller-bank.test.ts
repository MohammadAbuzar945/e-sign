import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminVerifyResellerBankAccount } from './admin-verify-reseller-bank';

const validatePaystackBankAccountMock = vi.fn();
const registerResellerPaystackSubaccountMock = vi.fn();
const bankSupportsPaystackAccountValidationMock = vi.fn();

vi.mock('@documenso/lib/server-only/paystack', () => ({
  validatePaystackBankAccount: (...args: unknown[]) => validatePaystackBankAccountMock(...args),
  getPaystackSubaccount: vi.fn(),
}));

vi.mock('./register-reseller-paystack-subaccount', () => ({
  registerResellerPaystackSubaccount: (...args: unknown[]) =>
    registerResellerPaystackSubaccountMock(...args),
}));

vi.mock('./paystack-bank-verification-support', () => ({
  bankSupportsPaystackAccountValidation: (...args: unknown[]) =>
    bankSupportsPaystackAccountValidationMock(...args),
}));

vi.mock('./reseller-secrets', () => ({
  decryptResellerSecret: (value: string) => value,
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

const baseApplication = {
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
};

describe('adminVerifyResellerBankAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bankSupportsPaystackAccountValidationMock.mockResolvedValue(true);
  });

  it('creates the subaccount first and activates after Paystack validation succeeds', async () => {
    prismaMock.resellerApplication.findUnique.mockResolvedValue(baseApplication as never);

    registerResellerPaystackSubaccountMock.mockResolvedValue({
      subaccount: {
        subaccount_code: 'ACCT_new',
        id: 99,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

    validatePaystackBankAccountMock.mockResolvedValue({
      verified: true,
      accountHolderMatch: true,
      verificationMessage: 'Account is verified successfully',
    });

    prismaMock.resellerProfile.update
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_new',
        subaccountStatus: 'PENDING',
      } as never)
      .mockResolvedValueOnce({
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

    expect(registerResellerPaystackSubaccountMock).toHaveBeenCalledBefore(
      validatePaystackBankAccountMock,
    );
    expect(validatePaystackBankAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '0123456047',
        bankCode: '632005',
        countryCode: 'ZA',
        documentNumber: '9001015800088',
      }),
    );
    expect(result.validationFeeZar).toBe(3);
    expect(result.subaccountStatus).toBe('ACTIVE');
  });

  it('activates without validation when the bank does not support Paystack verification', async () => {
    prismaMock.resellerApplication.findUnique.mockResolvedValue(baseApplication as never);
    bankSupportsPaystackAccountValidationMock.mockResolvedValue(false);

    registerResellerPaystackSubaccountMock.mockResolvedValue({
      subaccount: {
        subaccount_code: 'ACCT_new',
        id: 99,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

    prismaMock.resellerProfile.update
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_new',
        subaccountStatus: 'PENDING',
        subaccountVerifiedAt: null,
      } as never)
      .mockResolvedValueOnce({
        id: 'profile_1',
        paystackSubaccountCode: 'ACCT_new',
        subaccountStatus: 'ACTIVE',
      } as never);

    const result = await adminVerifyResellerBankAccount({
      applicationId: 'app_1',
    });

    expect(validatePaystackBankAccountMock).not.toHaveBeenCalled();
    expect(result.validationSkipped).toBe(true);
    expect(result.validationFeeZar).toBe(0);
    expect(result.subaccountStatus).toBe('ACTIVE');
  });

  it('marks the profile failed when Paystack validation rejects the account', async () => {
    prismaMock.resellerApplication.findUnique.mockResolvedValue(baseApplication as never);

    registerResellerPaystackSubaccountMock.mockResolvedValue({
      subaccount: {
        subaccount_code: 'ACCT_new',
        id: 99,
        is_verified: false,
      },
      subaccountStatus: 'PENDING',
      subaccountVerifiedAt: null,
    });

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

    expect(registerResellerPaystackSubaccountMock).toHaveBeenCalled();
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
