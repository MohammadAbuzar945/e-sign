import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export type NomiaDocGenTemplateVariable = {
  id: number;
  variable_name: string;
  default_value: string;
  field_type: string;
  fillable_field: boolean;
  content_format: string;
  document_template_id: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type ParsedTemplateVariableContentFormat = {
  type?: string;
  signatory?: number;
  sendForEsign?: boolean;
  role?: string;
};

export type FetchResellerTermsTemplateVariablesOptions = {
  organizationId: number;
  templateId: number;
  credentials: {
    apiUrl?: string;
    authToken: string;
  };
};

const getDefaultNomiaApiBaseUrl = () => {
  return NEXT_PUBLIC_WEBAPP_URL() === 'https://sign.nomiadocs.com'
    ? 'https://tapi.nomiadocs.com'
    : 'https://api.nomiadocs.com';
};

export const getNomiaApiBaseUrl = (configuredUrl?: string) => {
  if (configuredUrl?.trim()) {
    return configuredUrl.trim().replace(/\/$/, '');
  }

  return getDefaultNomiaApiBaseUrl();
};

export const parseTemplateVariableContentFormat = (
  contentFormat: string,
): ParsedTemplateVariableContentFormat => {
  if (!contentFormat?.trim()) {
    return {};
  }

  try {
    return JSON.parse(contentFormat) as ParsedTemplateVariableContentFormat;
  } catch {
    return {};
  }
};

export const isSignatureTemplateVariable = (variable: NomiaDocGenTemplateVariable) => {
  const contentFormat = parseTemplateVariableContentFormat(variable.content_format);

  if (contentFormat.type === 'SIGNATURE') {
    return true;
  }

  return variable.fillable_field && contentFormat.sendForEsign === true;
};

export const getEditableTemplateVariables = (variables: NomiaDocGenTemplateVariable[]) =>
  variables.filter((variable) => !isSignatureTemplateVariable(variable));

export const getTemplateSignatoryIndexes = (variables: NomiaDocGenTemplateVariable[]) => {
  const indexes = new Set<number>();

  for (const variable of variables) {
    const contentFormat = parseTemplateVariableContentFormat(variable.content_format);

    if (typeof contentFormat.signatory === 'number' && contentFormat.signatory > 0) {
      indexes.add(contentFormat.signatory);
    }
  }

  return [...indexes].sort((a, b) => a - b);
};

export const fetchResellerTermsTemplateVariables = async ({
  organizationId,
  templateId,
  credentials,
}: FetchResellerTermsTemplateVariablesOptions): Promise<NomiaDocGenTemplateVariable[]> => {
  const authToken = credentials.authToken.trim();

  if (!authToken) {
    throw new Error('Nomia DocGen auth token is not configured in Admin Site Settings.');
  }

  const baseUrl = getNomiaApiBaseUrl(credentials.apiUrl);
  const requestUrl = `${baseUrl}/organizations/${organizationId}/document_templates/${templateId}/document_variables`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: authToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch reseller T&Cs template variables (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as {
    document_variables?: NomiaDocGenTemplateVariable[];
  };

  return (result.document_variables ?? []).filter((variable) => !variable.deleted_at);
};
