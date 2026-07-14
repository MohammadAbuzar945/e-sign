import { z } from 'zod';

export const ZAdminVerifyResellerBankAccountRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZAdminVerifyResellerBankAccountResponseSchema = z.object({
  success: z.literal(true),
  verified: z.literal(true),
  validationFeeZar: z.number(),
  verificationMessage: z.string(),
  accountHolderMatch: z.boolean().nullable(),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
  bankAccountType: z.enum(['personal', 'business']),
  bankDocumentType: z.enum(['identityNumber', 'passportNumber', 'businessRegistrationNumber']),
});

export const ZAdminRefreshResellerBankAccountStatusRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZAdminRefreshResellerBankAccountStatusResponseSchema = z.object({
  success: z.literal(true),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
  paystackIsVerified: z.boolean(),
  paystackActive: z.boolean(),
});

export const ZAdminRetryResellerSubaccountRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZAdminRetryResellerSubaccountResponseSchema = z.object({
  success: z.literal(true),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
});
