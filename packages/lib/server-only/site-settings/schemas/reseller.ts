import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_RESELLER_ID = 'reseller' as const;

export const ZSiteSettingsResellerSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_RESELLER_ID),
  data: z.object({
    termsDocGenTemplateId: z.coerce.number().optional(),
    termsDocGenOrganizationId: z.coerce.number().optional(),
    termsDocGenWorkspaceId: z.coerce.number().optional(),
    termsInternalTemplateId: z.coerce.number().optional(),
    docGenApiUrl: z.string().trim().optional(),
    docGenAuthToken: z.string().trim().optional(),
    docGenApiKey: z.string().trim().optional(),
    docGenApiEndpoint: z.string().trim().optional(),
    docGenEsignApiKey: z.string().trim().optional(),
  }),
});

export type TSiteSettingsResellerSchema = z.infer<typeof ZSiteSettingsResellerSchema>;
