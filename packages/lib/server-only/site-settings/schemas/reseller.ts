import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_RESELLER_ID = 'reseller' as const;

/**
 * Optional numeric IDs for site settings.
 * Empty / missing values stay unset (never coerced to 0).
 */
const ZOptionalSiteSettingIdSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && (Number.isNaN(value) || value === 0)) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.coerce.number().int().positive().optional());

export const ZSiteSettingsResellerSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_RESELLER_ID),
  data: z.object({
    termsDocGenTemplateId: ZOptionalSiteSettingIdSchema,
    termsDocGenOrganizationId: ZOptionalSiteSettingIdSchema,
    termsDocGenWorkspaceId: ZOptionalSiteSettingIdSchema,
    termsInternalTemplateId: ZOptionalSiteSettingIdSchema,
    docGenApiUrl: z.string().trim().optional(),
    docGenAuthToken: z.string().trim().optional(),
    docGenApiKey: z.string().trim().optional(),
    docGenApiEndpoint: z.string().trim().optional(),
    docGenEsignApiKey: z.string().trim().optional(),
  }),
});

export type TSiteSettingsResellerSchema = z.infer<typeof ZSiteSettingsResellerSchema>;
