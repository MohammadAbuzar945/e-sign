import { ResellerProfileStatus, ResellerSubaccountStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  createPaystackSubaccount,
  getPaystackSubaccount,
  updatePaystackSubaccount,
  validatePaystackBankAccount,
} from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

import { encryptResellerSecret, decryptResellerSecret, maskBankAccountNumber } from './reseller-secrets';
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

  return {
    application,
    profile,
    organisationName: application.organisation.name,
    accountNumber: decryptResellerSecret(profile.bankAccountNumber),
  };
};

export type AdminVerifyResellerBankAccountOptions = {
  applicationId: string;
  accountType: 'personal' | 'business';
  documentType: 'identityNumber' | 'passportNumber' | 'businessRegistrationNumber';
  documentNumber: string;
  countryCode?: string;
};

export const adminVerifyResellerBankAccount = async ({
  applicationId,
  accountType,
  documentType,
  documentNumber,
  countryCode = 'ZA',
}: AdminVerifyResellerBankAccountOptions) => {
  const { profile, organisationName, accountNumber } =
    await getResellerProfileForBankVerification(applicationId);

  let validation;

  try {
    validation = await validatePaystackBankAccount({
      accountNumber,
      accountName: profile.bankAccountName!,
      bankCode: profile.bankCode!,
      countryCode,
      accountType,
      documentType,
      documentNumber: documentNumber.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bank account validation failed';

    await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptResellerSecret(documentNumber.trim()),
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  if (!validation.verified) {
    const message = validation.verificationMessage || 'Bank account could not be verified';

    await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptResellerSecret(documentNumber.trim()),
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message,
    });
  }

  const description = `Nomia reseller: ${profile.affiliateSlug}`;
  const percentageCharge = Number(profile.platformFeePercent ?? 0);

  try {
    const subaccount = profile.paystackSubaccountCode
      ? await updatePaystackSubaccount({
          subaccountCode: profile.paystackSubaccountCode,
          businessName: organisationName,
          settlementBank: profile.bankCode!,
          accountNumber,
          percentageCharge,
          description,
        })
      : await createPaystackSubaccount({
          businessName: organisationName,
          settlementBank: profile.bankCode!,
          accountNumber,
          percentageCharge,
          description,
        });

    const updatedProfile = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptResellerSecret(documentNumber.trim()),
        paystackSubaccountCode: subaccount.subaccount_code,
        paystackSubaccountId: subaccount.id,
        subaccountStatus: ResellerSubaccountStatus.ACTIVE,
        subaccountVerifiedAt: new Date(),
        subaccountFailureReason: null,
      },
    });

    return {
      verified: true as const,
      verificationMessage: validation.verificationMessage || 'Account is verified successfully',
      accountHolderMatch: validation.accountHolderMatch ?? null,
      subaccountStatus: updatedProfile.subaccountStatus,
      paystackSubaccountCode: updatedProfile.paystackSubaccountCode,
      bankAccountNumber: maskBankAccountNumber(updatedProfile.bankAccountNumber),
      bankAccountName: updatedProfile.bankAccountName,
      bankName: updatedProfile.bankName,
      bankCode: updatedProfile.bankCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register Paystack subaccount';

    await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptResellerSecret(documentNumber.trim()),
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Bank validated, but subaccount registration failed: ${message}`,
    });
  }
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
      message: 'No Paystack subaccount exists for this reseller yet. Verify the bank account first.',
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

  const description = `Nomia reseller: ${profile.affiliateSlug}`;
  const percentageCharge = Number(profile.platformFeePercent ?? 0);

  try {
    const subaccount = profile.paystackSubaccountCode
      ? await updatePaystackSubaccount({
          subaccountCode: profile.paystackSubaccountCode,
          businessName: organisationName,
          settlementBank: profile.bankCode!,
          accountNumber,
          percentageCharge,
          description,
        })
      : await createPaystackSubaccount({
          businessName: organisationName,
          settlementBank: profile.bankCode!,
          accountNumber,
          percentageCharge,
          description,
        });

    const isVerified = subaccount.is_verified === true;

    const updatedProfile = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: {
        paystackSubaccountCode: subaccount.subaccount_code,
        paystackSubaccountId: subaccount.id,
        subaccountStatus: isVerified
          ? ResellerSubaccountStatus.ACTIVE
          : ResellerSubaccountStatus.PENDING,
        subaccountVerifiedAt: isVerified ? new Date() : null,
        subaccountFailureReason: null,
      },
    });

    // Pull latest verification state from Paystack after create/update.
    await syncResellerSubaccountStatus(profile.organisationId);

    const refreshed = await prisma.resellerProfile.findUniqueOrThrow({
      where: { id: profile.id },
    });

    return {
      subaccountStatus: refreshed.subaccountStatus ?? updatedProfile.subaccountStatus,
      paystackSubaccountCode:
        refreshed.paystackSubaccountCode ?? updatedProfile.paystackSubaccountCode,
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
