import type { ResellerTermsVariableValues } from '@documenso/lib/constants/reseller-terms-variables';

import {
  getNomiaApiBaseUrl,
  isSignatureTemplateVariable,
  parseTemplateVariableContentFormat,
  type NomiaDocGenTemplateVariable,
} from './fetch-template-variables';
import {
  fetchWorkspaceEsignSettings,
  hasWorkspaceEsignApiKeyConfigured,
} from './fetch-workspace-esign-settings';

export type { NomiaDocGenTemplateVariable } from './fetch-template-variables';
export {
  fetchResellerTermsTemplateVariables,
  getEditableTemplateVariables,
  getTemplateSignatoryIndexes,
  getNomiaApiBaseUrl,
  isSignatureTemplateVariable,
  parseTemplateVariableContentFormat,
} from './fetch-template-variables';
export {
  fetchWorkspaceEsignSettings,
  hasWorkspaceEsignApiKeyConfigured,
} from './fetch-workspace-esign-settings';
export type { NomiaWorkspaceEsignSettings } from './fetch-workspace-esign-settings';

export type NomiaDocGenSignatory = {
  fullName: string;
  email: string;
  signatoryIndex?: number;
  role?: 'SIGNER';
};

export type NomiaDocGenOptions = {
  showInNomia: boolean;
  buildForEsign: boolean;
  sendForEsign: boolean;
  esignApiKey?: string;
};

export type NomiaDocGenCredentials = {
  apiUrl?: string;
  authToken: string;
  apiKey: string;
  apiEndpoint?: string;
  esignApiKey?: string;
};

export type GenerateResellerTermsDocumentOptions = {
  templateId: number;
  organizationId: number;
  workspaceId: number;
  documentName: string;
  variableValues: ResellerTermsVariableValues;
  templateVariables: NomiaDocGenTemplateVariable[];
  signatories: NomiaDocGenSignatory[];
  docGenOptions: NomiaDocGenOptions;
  credentials: NomiaDocGenCredentials;
  externalId?: string;
};

export type GenerateResellerTermsDocumentResult = {
  success: boolean;
  externalDocGenRequestId?: string;
  envelopeId?: string;
  pdfLink?: string;
};

const ID_FIELD_NAMES = [
  'document_record_id',
  'documentRecordId',
  'record_id',
  'recordId',
  'envelope_id',
  'envelopeId',
  'esign_envelope_id',
  'esignEnvelopeId',
  'request_id',
  'requestId',
  'external_id',
  'externalId',
] as const;

const ENVELOPE_FIELD_NAMES = [
  'envelope_id',
  'envelopeId',
  'esign_envelope_id',
  'esignEnvelopeId',
  'esign_document_id',
  'esignDocumentId',
] as const;

const PDF_LINK_FIELD_NAMES = [
  'pdf_link',
  'pdfLink',
  'link',
  'url',
  'pdf_url',
  'pdfUrl',
  'document_url',
  'documentUrl',
  'download_url',
  'downloadUrl',
  'file_url',
  'fileUrl',
] as const;

const LEGACY_ESIGN_TEXT_VARIABLES = new Set(['Preparedby', 'PreparedByEmail']);

export const buildVariableValuesRows = (
  templateVariables: NomiaDocGenTemplateVariable[],
  variableValues: ResellerTermsVariableValues,
  hasEsignFields: boolean,
) => {
  return templateVariables.map((variable) => {
    const contentFormat = parseTemplateVariableContentFormat(variable.content_format);
    const isSignatureField = isSignatureTemplateVariable(variable);

    const entry: {
      variable_name: string;
      value: string;
      type?: string;
      signatory?: number;
    } = {
      variable_name: variable.variable_name,
      value: isSignatureField ? '' : (variableValues[variable.variable_name] ?? ''),
    };

    if (!hasEsignFields) {
      return entry;
    }

    if (contentFormat.signatory) {
      entry.signatory = contentFormat.signatory;

      if (contentFormat.type) {
        entry.type = contentFormat.type;
      }
    } else if (LEGACY_ESIGN_TEXT_VARIABLES.has(variable.variable_name)) {
      entry.type = 'TEXT';
      entry.signatory = 1;
    }

    return entry;
  });
};

export const buildVariableValuesPayload = (
  templateVariables: NomiaDocGenTemplateVariable[],
  variableValues: ResellerTermsVariableValues,
  hasEsignFields: boolean,
) => {
  const rows = buildVariableValuesRows(templateVariables, variableValues, hasEsignFields);

  return JSON.stringify([rows]);
};

const normalizeId = (value: unknown) => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const findStringInObject = (value: unknown, fieldNames: readonly string[]): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringInObject(item, fieldNames);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const normalized = normalizeId(record[fieldName]);

    if (normalized) {
      return normalized;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const found = findStringInObject(nestedValue, fieldNames);

    if (found) {
      return found;
    }
  }

  return undefined;
};

const parseDocGenResponse = async ({
  response,
  externalId,
}: {
  response: Response;
  externalId?: string;
}): Promise<GenerateResellerTermsDocumentResult> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
    return {
      success: true,
      externalDocGenRequestId: externalId,
      envelopeId: undefined,
      pdfLink: undefined,
    };
  }

  const responseText = await response.text();

  if (!responseText) {
    return {
      success: true,
      externalDocGenRequestId: externalId,
      envelopeId: undefined,
      pdfLink: undefined,
    };
  }

  try {
    const result = JSON.parse(responseText) as unknown;

    const envelopeId = findStringInObject(result, ENVELOPE_FIELD_NAMES);
    const externalDocGenRequestId =
      findStringInObject(result, ID_FIELD_NAMES) ??
      normalizeId((result as Record<string, unknown>)?.id);
    const pdfLink = findStringInObject(result, PDF_LINK_FIELD_NAMES);

    return {
      success: true,
      externalDocGenRequestId: externalDocGenRequestId ?? externalId,
      envelopeId,
      pdfLink,
    };
  } catch {
    return {
      success: true,
      externalDocGenRequestId: externalId,
      envelopeId: undefined,
      pdfLink: undefined,
    };
  }
};

/**
 * Calls Nomia Africa DocGen API to generate reseller T&Cs.
 */
export const generateResellerTermsDocument = async ({
  templateId,
  organizationId,
  workspaceId,
  documentName,
  variableValues,
  templateVariables,
  signatories,
  docGenOptions,
  credentials,
  externalId,
}: GenerateResellerTermsDocumentOptions): Promise<GenerateResellerTermsDocumentResult> => {
  const authToken = credentials.authToken.trim();
  const apiKey = credentials.apiKey.trim();
  let esignApiKey =
    docGenOptions.esignApiKey?.trim() || credentials.esignApiKey?.trim() || undefined;

  if (!apiKey) {
    throw new Error('Nomia DocGen API key is not configured in Admin Site Settings.');
  }

  if (!authToken) {
    throw new Error('Nomia DocGen auth token is not configured in Admin Site Settings.');
  }

  if (templateVariables.length === 0) {
    throw new Error('No template variables were provided for reseller T&Cs generation.');
  }

  const hasEsignFields = docGenOptions.buildForEsign || docGenOptions.sendForEsign;

  if (hasEsignFields && !esignApiKey) {
    const workspaceEsignSettings = await fetchWorkspaceEsignSettings({
      organizationId,
      workspaceId,
      credentials: {
        apiUrl: credentials.apiUrl,
        authToken,
      },
    });

    if (hasWorkspaceEsignApiKeyConfigured(workspaceEsignSettings)) {
      // Workspace already has e-sign configured in Nomia — no site/form override needed.
      esignApiKey = undefined;
    } else {
      throw new Error(
        'An e-sign API key is required when build or send for e-sign is enabled and the Nomia DocGen workspace has no e-sign API key configured. Set it in Admin Site Settings, enter it in the send form, or configure e-sign settings on the Nomia workspace.',
      );
    }
  }

  const docGenApiUrl = getNomiaApiBaseUrl(credentials.apiUrl);
  const endpoint = credentials.apiEndpoint?.trim() || 'pdf_link';
  const requestUrl = `${docGenApiUrl}/document_records/api/${endpoint}`;

  const payload = {
    records: [
      {
        template_id: templateId,
        name: documentName,
        show_in_nomia: docGenOptions.showInNomia,
        variable_values: buildVariableValuesPayload(
          templateVariables,
          variableValues,
          hasEsignFields,
        ),
        dynamic_tables: [],
        dynamic_images: [],
      },
    ],
    api_key: apiKey,
    workspace_id: workspaceId,
    send_for_esign: docGenOptions.sendForEsign,
    build_for_esign: docGenOptions.buildForEsign,
    metadata: {
      subject: null,
      message: null,
      redirect_url: null,
      signing_order: 'PARALLEL',
    },
    external_id: externalId ?? null,
    // When omitted, Nomia uses the workspace e-sign settings if configured.
    esign_api_key: hasEsignFields ? (esignApiKey ?? null) : null,
    signatories: hasEsignFields
      ? signatories.map((signatory, index) => ({
          signatory_index: signatory.signatoryIndex ?? index + 1,
          full_name: signatory.fullName,
          email: signatory.email,
          role: signatory.role ?? 'SIGNER',
        }))
      : [],
  };

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nomia DocGen request failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return await parseDocGenResponse({ response, externalId });
};
