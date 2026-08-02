import { z } from 'zod';

import {
  RESELLER_TERMS_PROVIDER,
  ZResellerTermsProviderSchema,
} from '@documenso/lib/server-only/site-settings/schemas/reseller';

export const ZGetResellerTermsTemplateVariablesRequestSchema = z.void();

export const ZResellerTermsTemplateVariableSchema = z.object({
  id: z.number(),
  variable_name: z.string(),
  default_value: z.string(),
  field_type: z.string(),
  fillable_field: z.boolean(),
  content_format: z.string(),
  document_template_id: z.number(),
});

export const ZGetResellerTermsTemplateVariablesResponseSchema = z.object({
  provider: ZResellerTermsProviderSchema,
  variables: z.array(ZResellerTermsTemplateVariableSchema),
  editableVariables: z.array(ZResellerTermsTemplateVariableSchema),
});

export type TGetResellerTermsTemplateVariablesResponse = z.infer<
  typeof ZGetResellerTermsTemplateVariablesResponseSchema
>;

export { RESELLER_TERMS_PROVIDER };
