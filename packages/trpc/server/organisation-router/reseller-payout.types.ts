import { z } from 'zod';

import {
  ZResellerBankAccountTypeSchema,
  ZResellerBankDocumentTypeSchema,
} from '@documenso/lib/constants/reseller-bank-verification';
import {
  normalizeSaBankAccountNumber,
  normalizeSaPhoneNumber,
  normalizeSaVatNumber,
  refineResellerSaBankDetails,
  stripNonDigits,
} from '@documenso/lib/constants/reseller-sa-validation';

export const ZUpdateResellerPayoutModeRequestSchema = z.object({
  organisationId: z.string(),
  payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
});

export const ZUpdateResellerPayoutModeResponseSchema = z.object({
  success: z.literal(true),
  payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
});

export const ZResellerVatStatusSchema = z.enum(['NOT_REGISTERED', 'REGISTERED']);

export const ZUpdateResellerBankDetailsRequestSchema = z.object({
  organisationId: z.string(),
  data: z
    .object({
      bankCode: z.string().min(1),
      bankName: z.string().min(1),
      bankAccountNumber: z
        .string()
        .trim()
        .min(1, { message: 'Enter a bank account number' })
        .refine((value) => /^\d+$/.test(normalizeSaBankAccountNumber(value)), {
          message: 'Account number must contain digits only',
        }),
      bankAccountName: z.string().min(1, { message: 'Enter the account holder name' }),
      accountType: ZResellerBankAccountTypeSchema,
      documentType: ZResellerBankDocumentTypeSchema,
      documentNumber: z.string().trim().min(1).max(64),
      physicalAddress: z.string().trim().min(5).max(500),
      contactPhone: z.string().trim().min(1).max(32),
      contactEmail: z.string().trim().email().max(255),
      vatStatus: ZResellerVatStatusSchema,
      vatNumber: z.string().trim().max(64).optional(),
      confirmDetailsAccurate: z.boolean().refine((value) => value === true, {
        message:
          'You must confirm that the submitted information is accurate, current, lawfully supplied, and belongs to the reseller',
      }),
    })
    .superRefine((values, context) => {
      if (
        values.accountType === 'business' &&
        values.documentType !== 'businessRegistrationNumber'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Business accounts require a business registration number',
          path: ['documentType'],
        });
      }

      if (
        values.accountType === 'personal' &&
        values.documentType === 'businessRegistrationNumber'
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Personal accounts require a South African ID or passport number',
          path: ['documentType'],
        });
      }

      refineResellerSaBankDetails(values, (issue) => {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
        });
      });
    })
    .transform((values) => {
      const normalizedPhone = normalizeSaPhoneNumber(values.contactPhone);
      const normalizedDocumentNumber =
        values.documentType === 'identityNumber'
          ? stripNonDigits(values.documentNumber)
          : values.documentType === 'passportNumber'
            ? values.documentNumber.trim().toUpperCase()
            : values.documentNumber.trim().toUpperCase();

      return {
        ...values,
        bankAccountNumber: normalizeSaBankAccountNumber(values.bankAccountNumber),
        contactPhone: normalizedPhone ?? values.contactPhone,
        documentNumber: normalizedDocumentNumber,
        vatNumber:
          values.vatStatus === 'REGISTERED'
            ? normalizeSaVatNumber(values.vatNumber ?? '')
            : values.vatNumber,
      };
    }),
});

export const ZUpdateResellerBankDetailsResponseSchema = z.object({
  success: z.literal(true),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
});

export const ZListPaystackBanksRequestSchema = z.object({
  country: z.string().optional(),
});

export const ZListPaystackBanksResponseSchema = z.object({
  banks: z.array(
    z.object({
      name: z.string(),
      code: z.string(),
      currency: z.string(),
      supportedTypes: z.array(z.enum(['personal', 'business'])),
    }),
  ),
});

export const ZResolvePaystackBankAccountRequestSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .min(1, { message: 'Enter a bank account number' })
    .refine((value) => /^\d+$/.test(normalizeSaBankAccountNumber(value)), {
      message: 'Account number must contain digits only',
    }),
  bankCode: z.string().min(1),
  currency: z.string().optional(),
});

export const ZResolvePaystackBankAccountResponseSchema = z.object({
  accountNumber: z.string(),
  accountName: z.string(),
});

export const ZRefreshResellerSubaccountStatusRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZRefreshResellerSubaccountStatusResponseSchema = z.object({
  success: z.literal(true),
  subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
  paystackSubaccountCode: z.string().nullable(),
});
