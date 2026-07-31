import { z } from 'zod';

import {
  RESELLER_MIN_CREDITS_USED,
  RESELLER_MIN_SIGNUP_MONTHS,
} from '@documenso/lib/constants/esign-credit-packages';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_RESELLER_ID = 'reseller' as const;

export const RESELLER_TERMS_PROVIDER = {
  NOMIA_DOCGEN: 'NOMIA_DOCGEN',
  INTERNAL: 'INTERNAL',
} as const;

export type ResellerTermsProvider =
  (typeof RESELLER_TERMS_PROVIDER)[keyof typeof RESELLER_TERMS_PROVIDER];

export const DEFAULT_RESELLER_TERMS_PROVIDER = RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN;

export const ZResellerTermsProviderSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return DEFAULT_RESELLER_TERMS_PROVIDER;
    }

    return value;
  },
  z.enum([RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN, RESELLER_TERMS_PROVIDER.INTERNAL]),
);

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

/**
 * Optional positive eligibility thresholds.
 * Empty / missing values stay unset so code defaults apply.
 */
const ZOptionalEligibilityThresholdSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && (Number.isNaN(value) || value <= 0)) {
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
    termsProvider: ZResellerTermsProviderSchema,
    termsDocGenTemplateId: ZOptionalSiteSettingIdSchema,
    termsDocGenOrganizationId: ZOptionalSiteSettingIdSchema,
    termsDocGenWorkspaceId: ZOptionalSiteSettingIdSchema,
    termsInternalTemplateId: ZOptionalSiteSettingIdSchema,
    docGenApiUrl: z.string().trim().optional(),
    docGenAuthToken: z.string().trim().optional(),
    docGenApiKey: z.string().trim().optional(),
    docGenApiEndpoint: z.string().trim().optional(),
    docGenEsignApiKey: z.string().trim().optional(),
    minCreditsUsed: ZOptionalEligibilityThresholdSchema,
    minSignupMonths: ZOptionalEligibilityThresholdSchema,
  }),
});

export type TSiteSettingsResellerSchema = z.infer<typeof ZSiteSettingsResellerSchema>;

export type ResellerEligibilityThresholds = {
  minCreditsUsed: number;
  minSignupMonths: number;
};

export const resolveResellerEligibilityThresholds = (
  data: {
    minCreditsUsed?: number | null;
    minSignupMonths?: number | null;
  } | null | undefined,
): ResellerEligibilityThresholds => {
  const minCreditsUsed =
    typeof data?.minCreditsUsed === 'number' && data.minCreditsUsed > 0
      ? data.minCreditsUsed
      : RESELLER_MIN_CREDITS_USED;

  const minSignupMonths =
    typeof data?.minSignupMonths === 'number' && data.minSignupMonths > 0
      ? data.minSignupMonths
      : RESELLER_MIN_SIGNUP_MONTHS;

  return {
    minCreditsUsed,
    minSignupMonths,
  };
};

export const resolveResellerTermsProvider = (
  value: unknown,
): ResellerTermsProvider => {
  const parsed = ZResellerTermsProviderSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_RESELLER_TERMS_PROVIDER;
};
