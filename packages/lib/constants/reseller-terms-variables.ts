import type { NomiaDocGenTemplateVariable } from '@documenso/lib/server-only/nomia-docgen/fetch-template-variables';
import {
  getEditableTemplateVariables,
  getTemplateSignatoryIndexes,
} from '@documenso/lib/server-only/nomia-docgen/fetch-template-variables';

export type ResellerTermsVariableValues = Record<string, string>;

export type ResellerTermsSignatory = {
  signatoryIndex: number;
  fullName: string;
  email: string;
  role: 'SIGNER';
};

/** Fallback Nomia company signer if the sending admin session has no name/email. */
export const DEFAULT_RESELLER_TERMS_COMPANY_SIGNATORY = {
  fullName: 'Abuzar',
  email: 'awanabuzar945@gmail.com',
  role: 'SIGNER' as const,
};

/** DocGen template variable for the generated agreement title. */
export const RESELLER_TERMS_DOCUMENT_TITLE_VARIABLE = 'DocumentTitle';

/** DocGen template variable for the agreement effective date. */
export const RESELLER_TERMS_EFFECTIVE_DATE_VARIABLE = 'EffectiveDate';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

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
    PartyFull: (ctx) => ctx.organisationName,
    PartySN: (ctx) =>
      ctx.organisationName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'ON',
  };

const RESELLER_TERMS_VARIABLE_LABELS: Record<string, string> = {
  PartyFull: 'Organisation Name',
  PartyRegNo: 'Reg No',
  PartyAddress: 'Address',
  PartySN: 'Organisation Short Name',
  DocumentTitle: 'Document Title',
  EffectiveDate: 'Effective Date',
};

export const formatResellerTermsVariableLabel = (variableName: string) =>
  RESELLER_TERMS_VARIABLE_LABELS[variableName] ??
  variableName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();

export const isResellerTermsDocumentTitleVariable = (variableName: string) =>
  variableName.toLowerCase() === RESELLER_TERMS_DOCUMENT_TITLE_VARIABLE.toLowerCase();

export const isResellerTermsEffectiveDateVariable = (variableName: string) =>
  variableName.toLowerCase() === RESELLER_TERMS_EFFECTIVE_DATE_VARIABLE.toLowerCase();

/** Variables applicants fill on apply; Document Title and Effective Date are admin-only. */
export const isResellerTermsApplicantEditableVariable = (variableName: string) =>
  !isResellerTermsDocumentTitleVariable(variableName) &&
  !isResellerTermsEffectiveDateVariable(variableName);

export const formatResellerTermsDocumentTitle = (
  shortName: string,
  date: Date = new Date(),
) => {
  const resolvedShortName = shortName.trim() || 'ON';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `Nomia Reseller Agreement ${resolvedShortName} ${year}-${month}-${day}`;
};

export const formatResellerTermsEffectiveDate = (date: Date = new Date()) =>
  `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

export const parseResellerTermsVariableValues = (
  value: unknown,
): ResellerTermsVariableValues | null => {
  if (!value) {
    return null;
  }

  let parsedValue: unknown = value;

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return null;
  }

  const entries = Object.entries(parsedValue as Record<string, unknown>).flatMap(
    ([key, entryValue]) => {
      if (typeof entryValue === 'string') {
        return [[key, entryValue] as const];
      }

      if (typeof entryValue === 'number' || typeof entryValue === 'boolean') {
        return [[key, String(entryValue)] as const];
      }

      return [];
    },
  );

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
};

const getStoredVariableValue = (
  storedVariableValues: ResellerTermsVariableValues | null | undefined,
  variableName: string,
) => {
  if (!storedVariableValues) {
    return undefined;
  }

  if (storedVariableValues[variableName] !== undefined) {
    return storedVariableValues[variableName];
  }

  const matchedKey = Object.keys(storedVariableValues).find(
    (key) => key.toLowerCase() === variableName.toLowerCase(),
  );

  return matchedKey ? storedVariableValues[matchedKey] : undefined;
};

const resolveTemplateVariableName = ({
  templateVariables,
  values,
  matches,
  fallback,
}: {
  templateVariables: NomiaDocGenTemplateVariable[];
  values: ResellerTermsVariableValues;
  matches: (variableName: string) => boolean;
  fallback: string;
}) => {
  const fromTemplate = templateVariables.find((variable) =>
    matches(variable.variable_name),
  )?.variable_name;

  if (fromTemplate) {
    return fromTemplate;
  }

  const fromValues = Object.keys(values).find((key) => matches(key));

  return fromValues ?? fallback;
};

/**
 * Ensures admin-managed fields are set:
 * - Document Title: `Nomia Reseller Agreement {PartySN} YYYY-MM-DD`
 * - Effective Date: today's date (e.g. `1 August 2026`)
 */
export const ensureResellerTermsAdminFilledVariables = (
  values: ResellerTermsVariableValues,
  templateVariables: NomiaDocGenTemplateVariable[] = [],
  date: Date = new Date(),
): ResellerTermsVariableValues => {
  let nextValues = { ...values };

  const hasDocumentTitle =
    templateVariables.some((variable) =>
      isResellerTermsDocumentTitleVariable(variable.variable_name),
    ) || Object.keys(values).some((key) => isResellerTermsDocumentTitleVariable(key));

  if (hasDocumentTitle) {
    const shortName = getStoredVariableValue(nextValues, 'PartySN') ?? '';
    const titleKey = resolveTemplateVariableName({
      templateVariables,
      values: nextValues,
      matches: isResellerTermsDocumentTitleVariable,
      fallback: RESELLER_TERMS_DOCUMENT_TITLE_VARIABLE,
    });

    nextValues = {
      ...nextValues,
      [titleKey]: formatResellerTermsDocumentTitle(shortName, date),
    };
  }

  const hasEffectiveDate =
    templateVariables.some((variable) =>
      isResellerTermsEffectiveDateVariable(variable.variable_name),
    ) || Object.keys(values).some((key) => isResellerTermsEffectiveDateVariable(key));

  if (hasEffectiveDate) {
    const effectiveDateKey = resolveTemplateVariableName({
      templateVariables,
      values: nextValues,
      matches: isResellerTermsEffectiveDateVariable,
      fallback: RESELLER_TERMS_EFFECTIVE_DATE_VARIABLE,
    });

    nextValues = {
      ...nextValues,
      [effectiveDateKey]: formatResellerTermsEffectiveDate(date),
    };
  }

  return nextValues;
};

/** @deprecated Prefer ensureResellerTermsAdminFilledVariables */
export const ensureResellerTermsDocumentTitle = (
  values: ResellerTermsVariableValues,
  templateVariables: NomiaDocGenTemplateVariable[] = [],
  date: Date = new Date(),
): ResellerTermsVariableValues =>
  ensureResellerTermsAdminFilledVariables(values, templateVariables, date);

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

  const values = Object.fromEntries(
    editableVariables.map((variable) => {
      const storedValue = getStoredVariableValue(storedVariableValues, variable.variable_name);
      const mappedValue = APPLICANT_VARIABLE_DEFAULT_GETTERS[variable.variable_name]?.(ctx);

      return [
        variable.variable_name,
        storedValue !== undefined && storedValue !== null
          ? String(storedValue)
          : (mappedValue ?? variable.default_value ?? ''),
      ];
    }),
  );

  return ensureResellerTermsAdminFilledVariables(values, editableVariables);
};

/**
 * Builds DocGen signatories from template variable `content_format.signatory` indexes.
 * Index 1 defaults to the admin sending the T&Cs; other indexes use the reseller applicant.
 */
export const createDefaultResellerTermsSignatories = ({
  applicantName,
  applicantEmail,
  senderName,
  senderEmail,
  templateVariables = [],
}: {
  applicantName: string;
  applicantEmail: string;
  /** Admin who is sending the terms (Signatory 1). */
  senderName?: string | null;
  senderEmail?: string | null;
  templateVariables?: NomiaDocGenTemplateVariable[];
}): ResellerTermsSignatory[] => {
  const companySigner = {
    fullName: senderName?.trim() || DEFAULT_RESELLER_TERMS_COMPANY_SIGNATORY.fullName,
    email: senderEmail?.trim() || DEFAULT_RESELLER_TERMS_COMPANY_SIGNATORY.email,
    role: 'SIGNER' as const,
  };

  const signatoryIndexes = getTemplateSignatoryIndexes(templateVariables);

  if (signatoryIndexes.length === 0) {
    return [
      {
        signatoryIndex: 1,
        fullName: companySigner.fullName,
        email: companySigner.email,
        role: 'SIGNER',
      },
      {
        signatoryIndex: 2,
        fullName: applicantName,
        email: applicantEmail,
        role: 'SIGNER',
      },
    ];
  }

  return signatoryIndexes.map((signatoryIndex) => {
    if (signatoryIndex === 1) {
      return {
        signatoryIndex,
        fullName: companySigner.fullName,
        email: companySigner.email,
        role: 'SIGNER' as const,
      };
    }

    return {
      signatoryIndex,
      fullName: applicantName,
      email: applicantEmail,
      role: 'SIGNER' as const,
    };
  });
};
