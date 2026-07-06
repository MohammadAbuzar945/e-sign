import type { NomiaDocGenTemplateVariable } from '@documenso/lib/server-only/nomia-docgen/fetch-template-variables';
import { getEditableTemplateVariables } from '@documenso/lib/server-only/nomia-docgen/fetch-template-variables';

export type ResellerTermsVariableValues = Record<string, string>;

type ResellerTermsDefaultContext = {
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
};

const APPLICANT_VARIABLE_DEFAULT_GETTERS: Record<string, (ctx: ResellerTermsDefaultContext) => string> =
  {
    Preparedby: (ctx) => ctx.applicantName,
    PreparedByEmail: (ctx) => ctx.applicantEmail,
    DL: (ctx) => ctx.applicantName,
    Client1: (ctx) => ctx.applicantName,
    Project: (ctx) => ctx.organisationName || 'Nomia',
    Environment: () => 'Production',
  };

export const formatResellerTermsVariableLabel = (variableName: string) =>
  variableName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();

export const createDefaultResellerTermsVariableValues = ({
  organisationName,
  applicantName,
  applicantEmail,
  templateVariables = [],
}: ResellerTermsDefaultContext & {
  templateVariables?: NomiaDocGenTemplateVariable[];
}): ResellerTermsVariableValues => {
  const ctx = { organisationName, applicantName, applicantEmail };
  const editableVariables = getEditableTemplateVariables(templateVariables);

  return Object.fromEntries(
    editableVariables.map((variable) => {
      const mappedValue = APPLICANT_VARIABLE_DEFAULT_GETTERS[variable.variable_name]?.(ctx);

      return [
        variable.variable_name,
        mappedValue ?? variable.default_value ?? '',
      ];
    }),
  );
};
