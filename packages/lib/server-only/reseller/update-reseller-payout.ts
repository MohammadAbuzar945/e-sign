import {
  ResellerCreditTransactionStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
  ResellerSubaccountStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  createPaystackSubaccount,
  getPaystackSubaccount,
  updatePaystackSubaccount,
  validatePaystackBankAccount,
} from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

import type {
  ResellerBankAccountType,
  ResellerBankDocumentType,
} from '@documenso/lib/constants/reseller-bank-verification';
import { encryptResellerSecret } from './reseller-secrets';

const getSubaccountStatusFromPaystack = (subaccount: {
  is_verified?: boolean;
  active?: boolean;
}) => {
  if (subaccount.is_verified === true && subaccount.active !== false) {
    return ResellerSubaccountStatus.ACTIVE;
  }

  return ResellerSubaccountStatus.PENDING;
};

export const syncResellerSubaccountStatus = async (organisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
  });

  if (!profile?.paystackSubaccountCode) {
    return profile;
  }

  if (profile.subaccountStatus === ResellerSubaccountStatus.ACTIVE) {
    return profile;
  }

  try {
    const subaccount = await getPaystackSubaccount(profile.paystackSubaccountCode);
    const nextStatus = getSubaccountStatusFromPaystack(subaccount);
    const isVerified = nextStatus === ResellerSubaccountStatus.ACTIVE;

    if (
      nextStatus === profile.subaccountStatus &&
      (!isVerified || profile.subaccountVerifiedAt !== null)
    ) {
      return profile;
    }

    return await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        subaccountStatus: nextStatus,
        subaccountVerifiedAt: isVerified ? (profile.subaccountVerifiedAt ?? new Date()) : null,
        subaccountFailureReason: null,
        paystackSubaccountId: subaccount.id,
        paystackSubaccountCode: subaccount.subaccount_code,
      },
    });
  } catch {
    return profile;
  }
};

export type UpdateResellerPayoutModeOptions = {
  organisationId: string;
  payoutMode: ResellerPayoutMode;
};

export const updateResellerPayoutMode = async ({
  organisationId,
  payoutMode,
}: UpdateResellerPayoutModeOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found',
    });
  }

  const pendingCount = await prisma.resellerCreditTransaction.count({
    where: {
      resellerProfileId: profile.id,
      status: ResellerCreditTransactionStatus.PENDING,
    },
  });

  if (pendingCount > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Cannot switch payout mode while credit purchases are still pending',
    });
  }

  return await prisma.resellerProfile.update({
    where: { organisationId },
    data: {
      payoutMode,
    },
  });
};

export type UpdateResellerBankDetailsOptions = {
  organisationId: string;
  bankCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  accountType: ResellerBankAccountType;
  documentType: ResellerBankDocumentType;
  documentNumber: string;
  countryCode?: string;
};

export const updateResellerBankDetails = async ({
  organisationId,
  bankCode,
  bankName,
  bankAccountNumber,
  bankAccountName,
  accountType,
  documentType,
  documentNumber,
  countryCode = 'ZA',
}: UpdateResellerBankDetailsOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    include: {
      organisation: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Reseller profile is not active',
    });
  }

  const trimmedAccountNumber = bankAccountNumber.trim();
  const trimmedAccountName = bankAccountName.trim();
  const trimmedDocumentNumber = documentNumber.trim();

  if (
    !bankCode.trim() ||
    !trimmedAccountNumber ||
    !trimmedAccountName ||
    !trimmedDocumentNumber
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        'Bank code, account number, account name, and verification document number are required',
    });
  }

  const encryptedAccountNumber = encryptResellerSecret(trimmedAccountNumber);
  const encryptedDocumentNumber = encryptResellerSecret(trimmedDocumentNumber);
  const description = `Nomia reseller: ${profile.affiliateSlug}`;
  const percentageCharge = Number(profile.platformFeePercent ?? 0);

  const persistFailedVerification = async (message: string) => {
    await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: encryptedAccountNumber,
        bankAccountName: trimmedAccountName,
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptedDocumentNumber,
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });
  };

  let validation;

  try {
    validation = await validatePaystackBankAccount({
      accountNumber: trimmedAccountNumber,
      accountName: trimmedAccountName,
      bankCode: bankCode.trim(),
      countryCode,
      accountType,
      documentType,
      documentNumber: trimmedDocumentNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bank account validation failed';
    await persistFailedVerification(message);

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  if (!validation.verified) {
    const message = validation.verificationMessage || 'Bank account could not be verified';
    await persistFailedVerification(message);

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  try {
    const subaccount = profile.paystackSubaccountCode
      ? await updatePaystackSubaccount({
          subaccountCode: profile.paystackSubaccountCode,
          businessName: profile.organisation.name,
          settlementBank: bankCode.trim(),
          accountNumber: trimmedAccountNumber,
          percentageCharge,
          description,
        })
      : await createPaystackSubaccount({
          businessName: profile.organisation.name,
          settlementBank: bankCode.trim(),
          accountNumber: trimmedAccountNumber,
          percentageCharge,
          description,
        });

    const subaccountStatus = getSubaccountStatusFromPaystack(subaccount);
    const isVerified = subaccountStatus === ResellerSubaccountStatus.ACTIVE;

    return await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: encryptedAccountNumber,
        bankAccountName: trimmedAccountName,
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptedDocumentNumber,
        paystackSubaccountCode: subaccount.subaccount_code,
        paystackSubaccountId: subaccount.id,
        subaccountStatus,
        subaccountVerifiedAt: isVerified ? new Date() : null,
        subaccountFailureReason: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register bank account';

    await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: encryptedAccountNumber,
        bankAccountName: trimmedAccountName,
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptedDocumentNumber,
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }
};
