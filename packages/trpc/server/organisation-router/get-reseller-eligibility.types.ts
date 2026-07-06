import { z } from 'zod';

export const ZGetResellerEligibilityRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetResellerEligibilityResponseSchema = z.object({
  isEligible: z.boolean(),
  creditsUsed: z.number(),
  requiredCredits: z.number(),
  hasSubscriptionTenure: z.boolean(),
  requiredSubscriptionMonths: z.number(),
  subscriptionStartDate: z.date().nullable(),
  hasActiveApplication: z.boolean(),
  hasActiveResellerProfile: z.boolean(),
  reasons: z.array(z.string()),
});
