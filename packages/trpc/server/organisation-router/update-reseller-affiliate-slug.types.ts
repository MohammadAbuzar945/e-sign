import { z } from 'zod';

export const ZUpdateResellerAffiliateSlugRequestSchema = z.object({
  organisationId: z.string(),
  affiliateSlug: z.string(),
});

export const ZUpdateResellerAffiliateSlugResponseSchema = z.object({
  affiliateSlug: z.string(),
  affiliateUrl: z.string(),
});
