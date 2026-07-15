import { ResellerProfileStatus, ResellerSubaccountStatus } from '@prisma/client';

import {
  PAYSTACK_SA_BANK_VALIDATION_FEE_ZAR,
} from '@documenso/lib/constants/reseller-bank-verification';
import {
  parseResellerBankAccountType,
  parseResellerBankDocumentType,
} from '@documenso/lib/constants/reseller-bank-verification';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  getPaystackSubaccount,
  validatePaystackBankAccount,
} from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

import { bankSupportsPaystackAccountValidation } from './paystack-bank-verification-support';
import { registerResellerPaystackSubaccount } from './register-reseller-paystack-subaccount';
import { decryptResellerSecret, maskBankAccountNumber } from './reseller-secrets';
import { syncResellerSubaccountStatus } from './update-reseller-payout';

const getResellerProfileForBankVerification = async (applicationId: string) => {
  const application = await prisma.resellerApplication.findUnique({
    where: { id: applicationId },
    include: {
      organisation: {
        include: {
          resellerProfile: true,
        },
      },
    },
  });

  if (!application) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller application not found',
    });
  }

  const profile = application.organisation.resellerProfile;

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Reseller profile must be active before verifying bank details',
    });
  }

  if (!profile.bankCode || !profile.bankAccountNumber || !profile.bankAccountName) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Reseller has not submitted bank details yet',
    });
  }

  const accountType = parseResellerBankAccountType(profile.bankAccountType);
  const documentType = parseResellerBankDocumentType(profile.bankDocumentType);

  if (!accountType || !documentType || !profile.bankDocumentNumber) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Reseller has not submitted verification details yet',
    });
  }

  return {
    application,
    profile,
    organisationName: application.organisation.name,
    accountNumber: decryptResellerSecret(profile.bankAccountNumber),
    accountType,
    documentType,
    documentNumber: decryptResellerSecret(profile.bankDocumentNumber),
  };
};

const markResellerBankVerificationFailed = async ({
  profileId,
  message,
}: {
  profileId: string;
  message: string;
}) => {
  await prisma.resellerProfile.update({
    where: { id: profileId },
    data: {
      subaccountStatus: ResellerSubaccountStatus.FAILED,
      subaccountFailureReason: message,
      subaccountVerifiedAt: null,
    },
  });
};

export type AdminVerifyResellerBankAccountOptions = {
  applicationId: string;
};

export const adminVerifyResellerBankAccount = async ({
  applicationId,
}: AdminVerifyResellerBankAccountOptions) => {
  const {
    profile,
    organisationName,
    accountNumber,
    accountType,
    documentType,
    documentNumber,
  } = await getResellerProfileForBankVerification(applicationId);

  let registeredProfile = profile;

  try {
    const registration = await registerResellerPaystackSubaccount({
      organisationName,
      affiliateSlug: profile.affiliateSlug,
      bankCode: profile.bankCode!,
      accountNumber,
      platformFeePercent: profile.platformFeePercent,
      existingSubaccountCode: profile.paystackSubaccountCode,
    });

    registeredProfile = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        paystackSubaccountCode: registration.subaccount.subaccount_code,
        paystackSubaccountId: registration.subaccount.id,
        subaccountStatus: registration.subaccountStatus,
        subaccountVerifiedAt: registration.subaccountVerifiedAt,
        subaccountFailureReason: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to register Paystack subaccount';

    await markResellerBankVerificationFailed({
      profileId: profile.id,
      message,
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  const supportsValidation = await bankSupportsPaystackAccountValidation(
    profile.bankCode!,
    accountType,
  );

  if (!supportsValidation) {
    const updatedProfile = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        subaccountStatus: ResellerSubaccountStatus.ACTIVE,
        subaccountVerifiedAt: registeredProfile.subaccountVerifiedAt ?? new Date(),
        subaccountFailureReason: null,
      },
    });

    return {
      verified: true as const,
      validationSkipped: true as const,
      validationFeeZar: 0,
      verificationMessage:
        'This bank does not support Paystack account validation. Subaccount registered without validation.',
      accountHolderMatch: null,
      subaccountStatus: updatedProfile.subaccountStatus,
      paystackSubaccountCode: updatedProfile.paystackSubaccountCode,
      bankAccountNumber: maskBankAccountNumber(updatedProfile.bankAccountNumber),
      bankAccountName: updatedProfile.bankAccountName,
      bankName: updatedProfile.bankName,
      bankCode: updatedProfile.bankCode,
      bankAccountType: accountType,
      bankDocumentType: documentType,
    };
  }

  let validation;

  try {
    validation = await validatePaystackBankAccount({
      accountNumber,
      accountName: profile.bankAccountName!,
      bankCode: profile.bankCode!,
      countryCode: 'ZA',
      accountType,
      documentType,
      documentNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bank account validation failed';

    await markResellerBankVerificationFailed({
      profileId: profile.id,
      message,
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  if (!validation.verified) {
    const message = validation.verificationMessage || 'Bank account could not be verified';

    await markResellerBankVerificationFailed({
      profileId: profile.id,
      message,
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  const updatedProfile = await prisma.resellerProfile.update({
    where: { id: profile.id },
    data: {
      subaccountStatus: ResellerSubaccountStatus.ACTIVE,
      subaccountVerifiedAt: new Date(),
      subaccountFailureReason: null,
    },
  });

  return {
    verified: true as const,
    validationSkipped: false as const,
    validationFeeZar: PAYSTACK_SA_BANK_VALIDATION_FEE_ZAR,
    verificationMessage: validation.verificationMessage || 'Account is verified successfully',
    accountHolderMatch: validation.accountHolderMatch ?? null,
    subaccountStatus: updatedProfile.subaccountStatus,
    paystackSubaccountCode: updatedProfile.paystackSubaccountCode,
    bankAccountNumber: maskBankAccountNumber(updatedProfile.bankAccountNumber),
    bankAccountName: updatedProfile.bankAccountName,
    bankName: updatedProfile.bankName,
    bankCode: updatedProfile.bankCode,
    bankAccountType: accountType,
    bankDocumentType: documentType,
  };
};

export type AdminRefreshResellerBankAccountStatusOptions = {
  applicationId: string;
};

export const adminRefreshResellerBankAccountStatus = async ({
  applicationId,
}: AdminRefreshResellerBankAccountStatusOptions) => {
  const { profile } = await getResellerProfileForBankVerification(applicationId);

  if (!profile.paystackSubaccountCode) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        'No Paystack subaccount exists for this reseller yet. Ask the reseller to submit bank details first.',
    });
  }

  try {
    const subaccount = await getPaystackSubaccount(profile.paystackSubaccountCode);
    const isVerified = subaccount.is_verified === true && subaccount.active !== false;

    const updatedProfile = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        paystackSubaccountCode: subaccount.subaccount_code,
        paystackSubaccountId: subaccount.id,
        subaccountStatus: isVerified
          ? ResellerSubaccountStatus.ACTIVE
          : ResellerSubaccountStatus.PENDING,
        subaccountVerifiedAt: isVerified ? (profile.subaccountVerifiedAt ?? new Date()) : null,
        subaccountFailureReason: null,
      },
    });

    return {
      subaccountStatus: updatedProfile.subaccountStatus,
      paystackSubaccountCode: updatedProfile.paystackSubaccountCode,
      bankAccountNumber: maskBankAccountNumber(updatedProfile.bankAccountNumber),
      bankAccountName: updatedProfile.bankAccountName,
      bankName: updatedProfile.bankName,
      bankCode: updatedProfile.bankCode,
      paystackIsVerified: subaccount.is_verified === true,
      paystackActive: subaccount.active !== false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh subaccount status';

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }
};

export type AdminRetryResellerSubaccountOptions = {
  applicationId: string;
};

export const adminRetryResellerSubaccount = async ({
  applicationId,
}: AdminRetryResellerSubaccountOptions) => {
  const { profile, organisationName, accountNumber } =
    await getResellerProfileForBankVerification(applicationId);

  try {
    const registration = await registerResellerPaystackSubaccount({
      organisationName,
      affiliateSlug: profile.affiliateSlug,
      bankCode: profile.bankCode!,
      accountNumber,
      platformFeePercent: profile.platformFeePercent,
      existingSubaccountCode: profile.paystackSubaccountCode,
    });

    await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        paystackSubaccountCode: registration.subaccount.subaccount_code,
        paystackSubaccountId: registration.subaccount.id,
        subaccountStatus: registration.subaccountStatus,
        subaccountVerifiedAt: registration.subaccountVerifiedAt,
        subaccountFailureReason: null,
      },
    });

    await syncResellerSubaccountStatus(profile.organisationId);

    const refreshed = await prisma.resellerProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });

    return {
      subaccountStatus: refreshed.subaccountStatus,
      paystackSubaccountCode: refreshed.paystackSubaccountCode,
      bankAccountNumber: maskBankAccountNumber(refreshed.bankAccountNumber),
      bankAccountName: refreshed.bankAccountName,
      bankName: refreshed.bankName,
      bankCode: refreshed.bankCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry subaccount registration';

    await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
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
