import { z } from 'zod';

export const ZAdminVerifyResellerBankAccountRequestSchema = z.object({
  applicationId: z.string(),
  accountType: z.enum(['personal', 'business']),
  documentType: z.enum(['identityNumber', 'passportNumber', 'businessRegistrationNumber']),
  documentNumber: z.string().min(5).max(64),
  countryCode: z.string().length(2).optional(),
});

export const ZAdminVerifyResellerBankAccountResponseSchema = z.object({
  success: z.literal(true),
  verified: z.literal(true),
  verificationMessage: z.string(),
  accountHolderMatch: z.boolean().nullable(),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
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
