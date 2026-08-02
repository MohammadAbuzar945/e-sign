import {
  ResellerCreditTransactionStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
  ResellerSubaccountStatus,
  ResellerVatStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getPaystackSubaccount } from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

import { ZResellerBankVerificationFieldsSchema } from '@documenso/lib/constants/reseller-bank-verification';
import {
  normalizeSaVatNumber,
  validateSaVatNumber,
} from '@documenso/lib/constants/reseller-sa-validation';
import { encryptResellerSecret, decryptResellerSecret } from './reseller-secrets';
import { registerResellerPaystackSubaccount } from './register-reseller-paystack-subaccount';
import { recordResellerVatRegistrationChange } from './reseller-vat-registration';

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
  accountType: 'personal' | 'business';
  documentType: 'identityNumber' | 'passportNumber' | 'businessRegistrationNumber';
  documentNumber: string;
  physicalAddress: string;
  contactPhone: string;
  contactEmail: string;
  vatStatus: ResellerVatStatus;
  vatNumber?: string;
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
  physicalAddress,
  contactPhone,
  contactEmail,
  vatStatus,
  vatNumber,
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
  const trimmedBankCode = bankCode.trim();
  const trimmedPhysicalAddress = physicalAddress.trim();
  const trimmedContactPhone = contactPhone.trim();
  const trimmedContactEmail = contactEmail.trim().toLowerCase();
  const trimmedVatNumber = vatNumber?.trim() ?? '';

  ZResellerBankVerificationFieldsSchema.parse({
    accountType,
    documentType,
    documentNumber: trimmedDocumentNumber,
  });

  if (!trimmedBankCode || !trimmedAccountNumber || !trimmedAccountName) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Bank code, account number, and account name are required',
    });
  }

  if (!trimmedPhysicalAddress || !trimmedContactPhone || !trimmedContactEmail) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Physical address and contact details are required',
    });
  }

  const normalizedVatNumber =
    vatStatus === ResellerVatStatus.REGISTERED ? normalizeSaVatNumber(trimmedVatNumber) : '';

  if (vatStatus === ResellerVatStatus.REGISTERED) {
    const vatError = validateSaVatNumber(trimmedVatNumber);

    if (vatError) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: vatError,
      });
    }
  }

  const encryptedAccountNumber = encryptResellerSecret(trimmedAccountNumber);
  const encryptedDocumentNumber = encryptResellerSecret(trimmedDocumentNumber);
  const trimmedBankName = bankName.trim();
  const nextVatNumber =
    vatStatus === ResellerVatStatus.REGISTERED ? normalizedVatNumber : null;

  const previousAccountNumber = profile.bankAccountNumber
    ? decryptResellerSecret(profile.bankAccountNumber)
    : null;
  const previousBankCode = (profile.bankCode ?? '').trim();
  const previousBankName = (profile.bankName ?? '').trim();
  const previousAccountName = (profile.bankAccountName ?? '').trim();

  // Paystack settlement fields only — skip API when contact/VAT/ID-only updates.
  const shouldSyncPaystackSubaccount =
    !profile.paystackSubaccountCode ||
    previousAccountNumber !== trimmedAccountNumber ||
    previousBankCode !== trimmedBankCode ||
    previousBankName !== trimmedBankName ||
    previousAccountName !== trimmedAccountName;

  const savedProfile = await prisma.$transaction(async (tx) => {
    const updated = await tx.resellerProfile.update({
      where: { organisationId },
      data: {
        bankCode: trimmedBankCode,
        bankName: trimmedBankName,
        bankAccountNumber: encryptedAccountNumber,
        bankAccountName: trimmedAccountName,
        bankAccountType: accountType,
        bankDocumentType: documentType,
        bankDocumentNumber: encryptedDocumentNumber,
        physicalAddress: trimmedPhysicalAddress,
        contactPhone: trimmedContactPhone,
        contactEmail: trimmedContactEmail,
        vatStatus,
        vatNumber: nextVatNumber,
        bankDetailsConfirmedAt: new Date(),
        ...(shouldSyncPaystackSubaccount ? { subaccountFailureReason: null } : {}),
      },
    });

    await recordResellerVatRegistrationChange({
      resellerProfileId: updated.id,
      status: vatStatus,
      vatNumber: nextVatNumber,
      tx,
    });

    return updated;
  });

  if (!shouldSyncPaystackSubaccount) {
    return savedProfile;
  }

  try {
    const { subaccount, subaccountStatus, subaccountVerifiedAt } =
      await registerResellerPaystackSubaccount({
        businessName: trimmedAccountName,
        affiliateSlug: profile.affiliateSlug,
        bankCode: trimmedBankCode,
        accountNumber: trimmedAccountNumber,
        platformFeePercent: profile.platformFeePercent,
        existingSubaccountCode: savedProfile.paystackSubaccountCode,
      });

    return await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        paystackSubaccountCode: subaccount.subaccount_code,
        paystackSubaccountId: subaccount.id,
        subaccountStatus,
        subaccountVerifiedAt,
        subaccountFailureReason: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to register Paystack subaccount';

    return await prisma.resellerProfile.update({
      where: { organisationId },
      data: {
        subaccountStatus: ResellerSubaccountStatus.FAILED,
        subaccountFailureReason: message,
        subaccountVerifiedAt: null,
      },
    });
  }
};
