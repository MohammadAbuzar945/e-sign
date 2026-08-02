import { z } from 'zod';

import { validateSaDocumentNumber } from './reseller-sa-validation';

export const RESELLER_BANK_ACCOUNT_TYPES = ['personal', 'business'] as const;

export const RESELLER_BANK_DOCUMENT_TYPES = [
  'identityNumber',
  'passportNumber',
  'businessRegistrationNumber',
] as const;

export type ResellerBankAccountType = (typeof RESELLER_BANK_ACCOUNT_TYPES)[number];
export type ResellerBankDocumentType = (typeof RESELLER_BANK_DOCUMENT_TYPES)[number];

export const ZResellerBankAccountTypeSchema = z.enum(RESELLER_BANK_ACCOUNT_TYPES);
export const ZResellerBankDocumentTypeSchema = z.enum(RESELLER_BANK_DOCUMENT_TYPES);

export const ZResellerBankVerificationFieldsSchema = z
  .object({
    accountType: ZResellerBankAccountTypeSchema,
    documentType: ZResellerBankDocumentTypeSchema,
    documentNumber: z.string().trim().min(1).max(64),
  })
  .superRefine((values, context) => {
    if (values.accountType === 'business' && values.documentType !== 'businessRegistrationNumber') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Business accounts require a business registration number',
        path: ['documentType'],
      });
    }

    if (
      values.accountType === 'personal' &&
      values.documentType === 'businessRegistrationNumber'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Personal accounts require a South African ID or passport number',
        path: ['documentType'],
      });
    }

    const documentError = validateSaDocumentNumber({
      documentType: values.documentType,
      documentNumber: values.documentNumber,
    });

    if (documentError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: documentError,
        path: ['documentNumber'],
      });
    }
  });

export const getResellerBankAccountTypeLabel = (accountType: ResellerBankAccountType) => {
  switch (accountType) {
    case 'personal':
      return 'Personal';
    case 'business':
      return 'Business';
    default:
      return accountType;
  }
};

export const getResellerBankDocumentTypeLabel = (documentType: ResellerBankDocumentType) => {
  switch (documentType) {
    case 'identityNumber':
      return 'South African ID number';
    case 'passportNumber':
      return 'South African passport number';
    case 'businessRegistrationNumber':
      return 'Business registration number';
    default:
      return documentType;
  }
};

export const getResellerBankDocumentTypesForAccountType = (
  accountType: ResellerBankAccountType,
): ResellerBankDocumentType[] => {
  if (accountType === 'business') {
    return ['businessRegistrationNumber'];
  }

  return ['identityNumber', 'passportNumber'];
};

export const getDefaultResellerBankDocumentType = (
  accountType: ResellerBankAccountType,
): ResellerBankDocumentType => {
  return getResellerBankDocumentTypesForAccountType(accountType)[0];
};

export const getSupportedAccountTypesForBank = (
  supportedTypes?: ResellerBankAccountType[],
): ResellerBankAccountType[] => {
  if (!supportedTypes || supportedTypes.length === 0) {
    return [...RESELLER_BANK_ACCOUNT_TYPES];
  }

  return supportedTypes;
};

export const isAccountTypeSupportedByBank = (
  accountType: ResellerBankAccountType,
  supportedTypes?: ResellerBankAccountType[],
) => {
  return getSupportedAccountTypesForBank(supportedTypes).includes(accountType);
};

export const parseResellerBankAccountType = (
  value: string | null | undefined,
): ResellerBankAccountType | null => {
  const result = ZResellerBankAccountTypeSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  return result.data;
};

export const parseResellerBankDocumentType = (
  value: string | null | undefined,
): ResellerBankDocumentType | null => {
  const result = ZResellerBankDocumentTypeSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  return result.data;
};
