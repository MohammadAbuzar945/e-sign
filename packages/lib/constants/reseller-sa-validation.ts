import {
  getBankByCode,
  SA_ACCOUNT_NUMBER_FALLBACK_LENGTH,
  SA_BANKS,
  saAccountNumberError,
} from '../validation/sa-bank-account';
import type { ResellerBankDocumentType } from './reseller-bank-verification';

/** Digits-only length ranges for major SA banks (Paystack codes + name match fallback). */
type SaBankAccountLengthRule = {
  codes?: string[];
  nameIncludes?: string[];
  min: number;
  max: number;
};

/**
 * Account number length expectations for common South African banks.
 * Built from SA_BANKS plus Paystack code aliases / name matches.
 * Unknown banks fall back to 9–11 digits.
 */
export const SA_BANK_ACCOUNT_LENGTH_RULES: SaBankAccountLengthRule[] = [
  ...SA_BANKS.map((bank) => ({
    codes: [bank.code],
    nameIncludes: [bank.name.toLowerCase()],
    min: bank.accountLengthMin,
    max: bank.accountLengthMax,
  })),
  // Paystack / historical code aliases that map to the same length rules.
  {
    codes: ['450105'],
    nameIncludes: ['capitec'],
    min: 10,
    max: 10,
  },
  {
    codes: ['200355', '201419'],
    nameIncludes: ['first national', 'first national bank', 'fnb'],
    min: 11,
    max: 11,
  },
  {
    codes: ['632018'],
    nameIncludes: ['absa'],
    min: 8,
    max: 11,
  },
  {
    codes: ['730020'],
    nameIncludes: ['standard bank'],
    min: 9,
    max: 11,
  },
  {
    codes: ['198251'],
    nameIncludes: ['nedbank'],
    min: 9,
    max: 12,
  },
  {
    codes: ['678914'],
    nameIncludes: ['tyme'],
    min: 10,
    max: 12,
  },
];

export const SA_BANK_ACCOUNT_FALLBACK_LENGTH = SA_ACCOUNT_NUMBER_FALLBACK_LENGTH;

export const stripNonDigits = (value: string) => value.replace(/\D/g, '');

export const normalizeSaBankAccountNumber = (value: string) => stripNonDigits(value.trim());

export const resolveSaBankAccountLengthRule = ({
  bankCode,
  bankName,
}: {
  bankCode?: string | null;
  bankName?: string | null;
}) => {
  const normalizedCode = (bankCode ?? '').trim();
  const normalizedName = (bankName ?? '').trim().toLowerCase();

  const matchedRule = SA_BANK_ACCOUNT_LENGTH_RULES.find((rule) => {
    if (normalizedCode && rule.codes?.includes(normalizedCode)) {
      return true;
    }

    if (normalizedName && rule.nameIncludes?.some((part) => normalizedName.includes(part))) {
      return true;
    }

    return false;
  });

  return matchedRule
    ? { min: matchedRule.min, max: matchedRule.max }
    : { ...SA_BANK_ACCOUNT_FALLBACK_LENGTH };
};

export const validateSaBankAccountNumber = ({
  bankCode,
  bankName,
  accountNumber,
}: {
  bankCode?: string | null;
  bankName?: string | null;
  accountNumber: string;
}): string | null => {
  // Prefer SA_BANKS format rules when the selected code is a known universal branch code.
  if (bankCode && getBankByCode(bankCode)) {
    return saAccountNumberError(accountNumber, bankCode);
  }

  const digits = normalizeSaBankAccountNumber(accountNumber);

  if (!digits) {
    return 'Enter a bank account number';
  }

  if (/[^0-9\s-]/.test(accountNumber)) {
    return 'Account number must contain digits only';
  }

  const { min, max } = resolveSaBankAccountLengthRule({ bankCode, bankName });

  if (digits.length < min || digits.length > max) {
    if (min === max) {
      return `Account number for this bank must be ${min} digits`;
    }

    return `Account number for this bank must be ${min}–${max} digits`;
  }

  return null;
};

/**
 * Accepts SA local (0XXXXXXXXX) or international (+27 / 27) formats.
 * Returns normalized E.164 (+27XXXXXXXXX) or null if invalid.
 */
export const normalizeSaPhoneNumber = (value: string): string | null => {
  const trimmed = value.trim().replace(/[\s\-()]/g, '');

  if (!trimmed) {
    return null;
  }

  let digits = trimmed;

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`;
  }

  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`;
  }

  return null;
};

export const validateSaPhoneNumber = (value: string): string | null => {
  if (!value.trim()) {
    return 'Enter a contact phone number';
  }

  if (!normalizeSaPhoneNumber(value)) {
    return 'Enter a valid South African phone number (e.g. 0821234567 or +27821234567)';
  }

  return null;
};

const isValidSaIdDatePart = (id: string) => {
  const year = Number.parseInt(id.slice(0, 2), 10);
  const month = Number.parseInt(id.slice(2, 4), 10);
  const day = Number.parseInt(id.slice(4, 6), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  // Use a sliding century window so YYMMDD maps to a plausible calendar date.
  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear + 5 ? 2000 + year : 1900 + year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));

  return (
    date.getUTCFullYear() === fullYear &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/** South African ID number checksum (Luhn-style as used for SA IDs). */
export const isValidSaIdentityNumber = (value: string): boolean => {
  const id = stripNonDigits(value);

  if (!/^\d{13}$/.test(id)) {
    return false;
  }

  if (!isValidSaIdDatePart(id)) {
    return false;
  }

  let oddSum = 0;

  for (let index = 0; index < 12; index += 2) {
    oddSum += Number.parseInt(id.charAt(index), 10);
  }

  let evenString = '';

  for (let index = 1; index < 12; index += 2) {
    evenString += id.charAt(index);
  }

  const evenNumber = (Number.parseInt(evenString, 10) * 2).toString();
  let evenSum = 0;

  for (let index = 0; index < evenNumber.length; index += 1) {
    evenSum += Number.parseInt(evenNumber.charAt(index), 10);
  }

  const total = oddSum + evenSum;
  const checkDigit = (10 - (total % 10)) % 10;

  return checkDigit === Number.parseInt(id.charAt(12), 10);
};

export const validateSaIdentityNumber = (value: string): string | null => {
  const digits = stripNonDigits(value);

  if (!digits) {
    return 'Enter a South African ID number';
  }

  if (!/^\d{13}$/.test(digits)) {
    return 'South African ID number must be exactly 13 digits';
  }

  if (!isValidSaIdentityNumber(digits)) {
    return 'Enter a valid South African ID number';
  }

  return null;
};

/** SA passport: one letter followed by 8 digits (e.g. A12345678). */
export const isValidSaPassportNumber = (value: string): boolean => {
  return /^[A-Za-z]\d{8}$/.test(value.trim());
};

export const validateSaPassportNumber = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return 'Enter a South African passport number';
  }

  if (!isValidSaPassportNumber(normalized)) {
    return 'South African passport number must be 1 letter followed by 8 digits (e.g. A12345678)';
  }

  return null;
};

/** CIPC-style company registration or a reasonable alphanumeric registration number. */
export const validateSaBusinessRegistrationNumber = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return 'Enter a business registration number';
  }

  if (/^\d{4}\/\d{6}\/\d{2}$/.test(normalized)) {
    return null;
  }

  if (/^[A-Z0-9][A-Z0-9\-\/ ]{4,62}[A-Z0-9]$/i.test(normalized) && normalized.length <= 64) {
    return null;
  }

  return 'Enter a valid business registration number (e.g. 2020/123456/07)';
};

/**
 * South African VAT registration numbers are 10 digits and start with 4.
 * Format validation only — does not confirm SARS registration status.
 */
export const normalizeSaVatNumber = (value: string) => stripNonDigits(value.trim());

export const validateSaVatNumber = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Enter a VAT registration number';
  }

  if (/[^0-9\s-]/.test(trimmed)) {
    return 'VAT number must contain digits only';
  }

  const digits = normalizeSaVatNumber(trimmed);

  if (digits.length !== 10) {
    return 'VAT number must be exactly 10 digits';
  }

  if (!digits.startsWith('4')) {
    return 'VAT number must start with 4';
  }

  return null;
};

export const validateSaDocumentNumber = ({
  documentType,
  documentNumber,
}: {
  documentType: ResellerBankDocumentType;
  documentNumber: string;
}): string | null => {
  switch (documentType) {
    case 'identityNumber':
      return validateSaIdentityNumber(documentNumber);
    case 'passportNumber':
      return validateSaPassportNumber(documentNumber);
    case 'businessRegistrationNumber':
      return validateSaBusinessRegistrationNumber(documentNumber);
    default:
      return 'Invalid document type';
  }
};

export const refineResellerSaBankDetails = <
  T extends {
    bankCode: string;
    bankName: string;
    bankAccountNumber: string;
    documentType: ResellerBankDocumentType;
    documentNumber: string;
    contactPhone: string;
    vatStatus?: 'NOT_REGISTERED' | 'REGISTERED';
    vatNumber?: string;
  },
>(
  values: T,
  addIssue: (issue: { message: string; path: (keyof T | string)[] }) => void,
) => {
  const accountError = validateSaBankAccountNumber({
    bankCode: values.bankCode,
    bankName: values.bankName,
    accountNumber: values.bankAccountNumber,
  });

  if (accountError) {
    addIssue({ message: accountError, path: ['bankAccountNumber'] });
  }

  const phoneError = validateSaPhoneNumber(values.contactPhone);

  if (phoneError) {
    addIssue({ message: phoneError, path: ['contactPhone'] });
  }

  const documentError = validateSaDocumentNumber({
    documentType: values.documentType,
    documentNumber: values.documentNumber,
  });

  if (documentError) {
    addIssue({ message: documentError, path: ['documentNumber'] });
  }

  if (values.vatStatus === 'REGISTERED') {
    const vatError = validateSaVatNumber(values.vatNumber ?? '');

    if (vatError) {
      addIssue({ message: vatError, path: ['vatNumber'] });
    }
  }
};
