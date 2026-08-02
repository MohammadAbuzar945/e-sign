import { z } from 'zod';

export const ZCheckResellerAffiliateSlugRequestSchema = z.object({
  organisationId: z.string(),
  affiliateSlug: z.string(),
});

export const ZCheckResellerAffiliateSlugResponseSchema = z.object({
  isValid: z.boolean(),
  isAvailable: z.boolean(),
  normalizedSlug: z.string(),
  message: z.string().nullable(),
});
