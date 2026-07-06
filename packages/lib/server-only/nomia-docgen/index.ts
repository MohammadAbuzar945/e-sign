import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { ResellerTermsVariableValues } from '@documenso/lib/constants/reseller-terms-variables';
import {
  RESELLER_TERMS_ESIGN_SIGNATORY_VARIABLES,
  RESELLER_TERMS_TEMPLATE_VARIABLES,
} from '@documenso/lib/constants/reseller-terms-variables';
import { env } from '@documenso/lib/utils/env';

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

export type GenerateResellerTermsDocumentOptions = {
  templateId: number;
  workspaceId: number;
  documentName: string;
  variableValues: ResellerTermsVariableValues;
  signatories: NomiaDocGenSignatory[];
  docGenOptions: NomiaDocGenOptions;
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

const getDocGenApiBaseUrl = () => {
  const configuredUrl = env('NOMIA_DOCGEN_API_URL');

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return NEXT_PUBLIC_WEBAPP_URL() === 'https://sign.nomiadocs.com'
    ? 'https://tapi.nomiadocs.com'
    : 'https://api.nomiadocs.com';
};

const buildVariableValuesRows = (
  variableValues: ResellerTermsVariableValues,
  hasEsignFields: boolean,
) => {
  return RESELLER_TERMS_TEMPLATE_VARIABLES.map((variableName) => {
    const entry: {
      variable_name: string;
      value: string;
      type?: string;
      signatory?: number;
    } = {
      variable_name: variableName,
      value: variableValues[variableName] ?? '',
    };

    if (
      hasEsignFields &&
      RESELLER_TERMS_ESIGN_SIGNATORY_VARIABLES.includes(
        variableName as (typeof RESELLER_TERMS_ESIGN_SIGNATORY_VARIABLES)[number],
      )
    ) {
      entry.type = 'TEXT';
      entry.signatory = 1;
    }

    return entry;
  });
};

const buildVariableValuesPayload = (
  variableValues: ResellerTermsVariableValues,
  hasEsignFields: boolean,
) => {
  const rows = buildVariableValuesRows(variableValues, hasEsignFields);

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
  workspaceId,
  documentName,
  variableValues,
  signatories,
  docGenOptions,
  externalId,
}: GenerateResellerTermsDocumentOptions): Promise<GenerateResellerTermsDocumentResult> => {
  const authToken = env('NOMIA_DOCGEN_AUTH_TOKEN');
  const apiKey = env('NOMIA_DOCGEN_API_KEY');
  const esignApiKey =
    docGenOptions.esignApiKey?.trim() || env('NOMIA_DOCGEN_ESIGN_API_KEY') || undefined;

  if (!apiKey) {
    throw new Error('NOMIA_DOCGEN_API_KEY is not configured.');
  }

  if (!authToken) {
    throw new Error('NOMIA_DOCGEN_AUTH_TOKEN is not configured.');
  }

  const hasEsignFields = docGenOptions.buildForEsign || docGenOptions.sendForEsign;

  if (hasEsignFields && !esignApiKey) {
    throw new Error(
      'An e-sign API key is required when build for e-sign or send for e-sign is enabled. Enter it in the form or set NOMIA_DOCGEN_ESIGN_API_KEY.',
    );
  }

  const docGenApiUrl = getDocGenApiBaseUrl();
  const endpoint = env('NOMIA_DOCGEN_API_ENDPOINT') ?? 'pdf_link';
  const requestUrl = `${docGenApiUrl}/document_records/api/${endpoint}`;

  const payload = {
    records: [
      {
        template_id: templateId,
        name: documentName,
        show_in_nomia: docGenOptions.showInNomia,
        variable_values: buildVariableValuesPayload(variableValues, hasEsignFields),
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
    esign_api_key: hasEsignFields ? esignApiKey : null,
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
