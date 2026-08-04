import { z } from 'zod';

import {
  normalizeSaVatNumber,
  validateSaVatNumber,
} from '@documenso/lib/constants/reseller-sa-validation';

import { ZTeamUrlSchema } from '../team-router/schema';
import { ZCreateOrganisationRequestSchema } from './create-organisation.types';

// export const updateOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/{teamId}',
//     summary: 'Update organisation',
//     description: 'Update an organisation',
//     tags: ['Organisation'],
//   },
// };

const ZOptionalOrganisationVatNumberSchema = z
  .string()
  .trim()
  .max(32)
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) {
      return null;
    }

    return normalizeSaVatNumber(value);
  })
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }

    const error = validateSaVatNumber(value);

    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  });

const ZOptionalOrganisationBillingAddressSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const ZUpdateOrganisationRequestSchema = z.object({
  data: ZCreateOrganisationRequestSchema.pick({
    name: true,
  }).extend({
    url: ZTeamUrlSchema,
    vatNumber: ZOptionalOrganisationVatNumberSchema,
    billingAddress: ZOptionalOrganisationBillingAddressSchema,
  }),
  organisationId: z.string(),
});

export const ZUpdateOrganisationResponseSchema = z.void();
