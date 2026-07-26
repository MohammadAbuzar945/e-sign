import { ResellerApplicationStatus } from '@prisma/client';
import { z } from 'zod';

export const ZGetResellerEligibilityRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZResellerApplicationSummarySchema = z.object({
  status: z.nativeEnum(ResellerApplicationStatus),
  appliedAt: z.date(),
  termsSentAt: z.date().nullable(),
  termsCompletedAt: z.date().nullable(),
  approvedAt: z.date().nullable(),
  rejectedAt: z.date().nullable(),
  rejectionReason: z.string().nullable(),
});

export const ZGetResellerEligibilityResponseSchema = z.object({
  isEligible: z.boolean(),
  creditsUsed: z.number(),
  requiredCredits: z.number(),
  hasSignupTenure: z.boolean(),
  requiredSignupMonths: z.number(),
  accountCreatedAt: z.date().nullable(),
  hasSubscriptionTenure: z.boolean(),
  requiredSubscriptionMonths: z.number(),
  subscriptionStartDate: z.date().nullable(),
  hasActiveApplication: z.boolean(),
  hasActiveResellerProfile: z.boolean(),
  application: ZResellerApplicationSummarySchema.nullable(),
  reasons: z.array(z.string()),
});
