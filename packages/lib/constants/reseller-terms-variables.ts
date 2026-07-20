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

export const parseResellerTermsVariableValues = (
  value: unknown,
): ResellerTermsVariableValues | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, entryValue]) => typeof key === 'string' && typeof entryValue === 'string',
  );

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as ResellerTermsVariableValues;
};

export const createDefaultResellerTermsVariableValues = ({
  organisationName,
  applicantName,
  applicantEmail,
  templateVariables = [],
  storedVariableValues,
}: ResellerTermsDefaultContext & {
  templateVariables?: NomiaDocGenTemplateVariable[];
  storedVariableValues?: ResellerTermsVariableValues | null;
}): ResellerTermsVariableValues => {
  const ctx = { organisationName, applicantName, applicantEmail };
  const editableVariables = getEditableTemplateVariables(templateVariables);

  return Object.fromEntries(
    editableVariables.map((variable) => {
      const storedValue = storedVariableValues?.[variable.variable_name];
      const mappedValue = APPLICANT_VARIABLE_DEFAULT_GETTERS[variable.variable_name]?.(ctx);

      return [
        variable.variable_name,
        storedValue !== undefined && storedValue !== null
          ? String(storedValue)
          : (mappedValue ?? variable.default_value ?? ''),
      ];
    }),
  );
};
