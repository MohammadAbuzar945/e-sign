import { z } from 'zod';

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
    documentNumber: z.string().trim().min(5).max(64),
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
        message: 'Personal accounts require an ID card, CNIC, or passport number',
        path: ['documentType'],
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
      return 'ID card / CNIC';
    case 'passportNumber':
      return 'Passport number';
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
