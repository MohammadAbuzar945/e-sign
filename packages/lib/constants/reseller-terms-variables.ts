/** Nomia DocGen template 839 — variable names must match the template exactly. */
export const RESELLER_TERMS_TEMPLATE_VARIABLES = [
  'Preparedby',
  'PreparedByEmail',
  'CEO',
  'DL',
  'CIO',
  'Project',
  'Client1',
  'Client2',
  'DD',
  'DT',
  'DW',
  'Environment',
  'DT1',
  'DT2',
] as const;

export type ResellerTermsTemplateVariableName =
  (typeof RESELLER_TERMS_TEMPLATE_VARIABLES)[number];

export type ResellerTermsVariableValues = Record<ResellerTermsTemplateVariableName, string>;

export const RESELLER_TERMS_VARIABLE_LABELS: Record<ResellerTermsTemplateVariableName, string> = {
  Preparedby: 'Prepared by',
  PreparedByEmail: 'Prepared by email',
  CEO: 'CEO',
  DL: 'Delivery lead (DL)',
  CIO: 'CIO',
  Project: 'Project',
  Client1: 'Client 1',
  Client2: 'Client 2',
  DD: 'Document date (DD)',
  DT: 'Document time (DT)',
  DW: 'Document duration (DW)',
  Environment: 'Environment',
  DT1: 'Document team 1 (DT1)',
  DT2: 'Document team 2 (DT2)',
};

/** Variables mapped to e-sign signatory 1 when build/send for e-sign is enabled. */
export const RESELLER_TERMS_ESIGN_SIGNATORY_VARIABLES = [
  'Preparedby',
  'PreparedByEmail',
] as const satisfies readonly ResellerTermsTemplateVariableName[];

export const createDefaultResellerTermsVariableValues = ({
  organisationName,
  applicantName,
  applicantEmail,
}: {
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
}): ResellerTermsVariableValues => ({
  Preparedby: applicantName,
  PreparedByEmail: applicantEmail,
  CEO: '',
  DL: applicantName,
  CIO: '',
  Project: organisationName || 'Nomia',
  Client1: applicantName,
  Client2: '',
  DD: '',
  DT: '',
  DW: '',
  Environment: 'Production',
  DT1: '',
  DT2: '',
});
