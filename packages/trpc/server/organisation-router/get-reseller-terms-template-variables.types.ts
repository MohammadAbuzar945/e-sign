import { z } from 'zod';

export const ZGetOrganisationResellerTermsTemplateVariablesRequestSchema = z.object({
  organisationId: z.string().min(1),
});

export const ZOrganisationResellerTermsTemplateVariableSchema = z.object({
  id: z.number(),
  variable_name: z.string(),
  default_value: z.string(),
  field_type: z.string(),
  fillable_field: z.boolean(),
  content_format: z.string(),
  document_template_id: z.number(),
});

export const ZGetOrganisationResellerTermsTemplateVariablesResponseSchema = z.object({
  variables: z.array(ZOrganisationResellerTermsTemplateVariableSchema),
  editableVariables: z.array(ZOrganisationResellerTermsTemplateVariableSchema),
});

export type TGetOrganisationResellerTermsTemplateVariablesResponse = z.infer<
  typeof ZGetOrganisationResellerTermsTemplateVariablesResponseSchema
>;
