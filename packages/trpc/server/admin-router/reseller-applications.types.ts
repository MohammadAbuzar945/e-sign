import { z } from 'zod';

import { RESELLER_ADMIN_VIEW } from '@documenso/lib/constants/reseller-application-status';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZResellerTermsVariableValuesSchema = z.record(z.string(), z.string());

export const ZResellerTermsSignatorySchema = z.object({
  signatoryIndex: z.number().int().positive(),
  fullName: z.string().min(1),
  email: z.string().email(),
  role: z.literal('SIGNER'),
});

export const ZSendResellerTermsApplicationSchema = z.object({
  applicationId: z.string(),
  variableValues: ZResellerTermsVariableValuesSchema,
  signatories: z.array(ZResellerTermsSignatorySchema).min(1),
  docGenOptions: z.object({
    showInNomia: z.boolean(),
    buildForEsign: z.boolean(),
    sendForEsign: z.boolean(),
    esignApiKey: z.string().optional(),
  }),
});

export const ZFindResellerApplicationsRequestSchema = ZFindSearchParamsSchema.extend({
  status: z.string().optional(),
  view: z
    .enum([RESELLER_ADMIN_VIEW.QUEUE, RESELLER_ADMIN_VIEW.ACCOUNTS, RESELLER_ADMIN_VIEW.CLOSED])
    .optional(),
});

export const ZFindResellerApplicationsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      appliedAt: z.date(),
      termsSentAt: z.date().nullable(),
      rejectionReason: z.string().nullable().optional(),
      snapshotOrgName: z.string(),
      snapshotApplicantName: z.string(),
      snapshotApplicantEmail: z.string(),
      snapshotCompletedDocCount: z.number(),
      snapshotUniqueSignerCount: z.number(),
      snapshotOrgUserCount: z.number(),
      snapshotOrgSignupDate: z.date(),
      termsVariableValues: ZResellerTermsVariableValuesSchema.nullable().optional(),
      liveCompletedDocCount: z.number(),
      liveUniqueSignerCount: z.number(),
      liveOrgUserCount: z.number(),
      organisation: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        createdAt: z.date(),
      }),
      resellerProfile: z
        .object({
          id: z.string(),
          status: z.string(),
          affiliateSlug: z.string(),
          allowNegativeCredits: z.boolean(),
          isDelinquent: z.boolean(),
          delinquentAt: z.date().nullable(),
          zeroBalanceSince: z.date().nullable(),
          availableCredits: z.number(),
          negativeCreditsUsed: z.number(),
          payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
          bankCode: z.string().nullable(),
          bankName: z.string().nullable(),
          bankAccountNumber: z.string().nullable(),
          bankAccountName: z.string().nullable(),
          bankAccountType: z.enum(['personal', 'business']).nullable(),
          bankDocumentType: z
            .enum(['identityNumber', 'passportNumber', 'businessRegistrationNumber'])
            .nullable(),
          physicalAddress: z.string().nullable(),
          contactPhone: z.string().nullable(),
          contactEmail: z.string().nullable(),
          vatStatus: z.enum(['NOT_REGISTERED', 'REGISTERED']).nullable(),
          vatNumber: z.string().nullable(),
          bankDetailsConfirmedAt: z.date().nullable(),
          paystackSubaccountCode: z.string().nullable(),
          subaccountStatus: z.enum(['PENDING', 'ACTIVE', 'FAILED']).nullable(),
          subaccountVerifiedAt: z.date().nullable(),
          subaccountFailureReason: z.string().nullable(),
          payoutReadiness: z
            .object({
              canAcceptPayments: z.boolean(),
              hasOwnPaystackConfigured: z.boolean(),
              hasNomiaSubaccountConfigured: z.boolean(),
              blockingReason: z.string().nullable(),
            })
            .optional(),
        })
        .nullish(),
      applicantUser: z.object({
        id: z.number(),
        name: z.string().nullable(),
        email: z.string(),
      }),
    }),
  ),
  count: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

export const ZSendResellerTermsRequestSchema = z.object({
  applications: z.array(ZSendResellerTermsApplicationSchema).min(1),
});

export const ZSendResellerTermsResponseSchema = z.object({
  sentCount: z.number(),
});

export const ZRejectResellerApplicationRequestSchema = z.object({
  applicationId: z.string(),
  rejectionReason: z.string().optional(),
});

export const ZRejectResellerApplicationResponseSchema = z.object({
  success: z.literal(true),
});

export const ZRetryResellerApplicationActivationRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZRetryResellerApplicationActivationResponseSchema = z.object({
  success: z.literal(true),
});
