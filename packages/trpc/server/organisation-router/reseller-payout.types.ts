import { z } from 'zod';

export const ZUpdateResellerPayoutModeRequestSchema = z.object({
  organisationId: z.string(),
  payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
});

export const ZUpdateResellerPayoutModeResponseSchema = z.object({
  success: z.literal(true),
  payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
});

export const ZUpdateResellerBankDetailsRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    bankCode: z.string().min(1),
    bankName: z.string().min(1),
    bankAccountNumber: z.string().min(5),
    bankAccountName: z.string().min(1),
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
    }),
  ),
});

export const ZResolvePaystackBankAccountRequestSchema = z.object({
  accountNumber: z.string().min(5),
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
