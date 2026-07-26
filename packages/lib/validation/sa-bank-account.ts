/**
 * South African bank account / branch-code format validation.
 *
 * Format validation only — these helpers do NOT confirm that an account exists,
 * is open, or belongs to a given person or business. Real-time verification
 * (e.g. Paystack resolve / AVS) is handled separately where required.
 */

export type SABank = {
  name: string;
  /** 6-digit universal branch code (also used as Paystack SA bank code where aligned). */
  code: string;
  /** Inclusive typical account-number length range for this bank. */
  accountLengthMin: number;
  accountLengthMax: number;
};

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Major South African banks with universal branch codes and typical account lengths.
 * Length ranges are format expectations only and may not cover every product type.
 */
export const SA_BANKS: SABank[] = [
  {
    name: 'Absa',
    code: '632005',
    accountLengthMin: 8,
    accountLengthMax: 11,
  },
  {
    name: 'African Bank',
    code: '430000',
    accountLengthMin: 10,
    accountLengthMax: 11,
  },
  {
    name: 'Bidvest Bank',
    code: '462005',
    accountLengthMin: 10,
    accountLengthMax: 11,
  },
  {
    name: 'Capitec Bank',
    code: '470010',
    accountLengthMin: 10,
    accountLengthMax: 10,
  },
  {
    name: 'Discovery Bank',
    code: '679000',
    accountLengthMin: 11,
    accountLengthMax: 11,
  },
  {
    name: 'FNB',
    code: '250655',
    accountLengthMin: 11,
    accountLengthMax: 11,
  },
  {
    name: 'Investec',
    code: '580105',
    accountLengthMin: 11,
    accountLengthMax: 11,
  },
  {
    name: 'Nedbank',
    code: '198765',
    accountLengthMin: 9,
    accountLengthMax: 12,
  },
  {
    name: 'Standard Bank',
    code: '051001',
    accountLengthMin: 9,
    accountLengthMax: 11,
  },
  {
    name: 'TymeBank',
    code: '678910',
    accountLengthMin: 10,
    accountLengthMax: 12,
  },
];

/** Base SA account-number length when no known bank rule applies. */
export const SA_ACCOUNT_NUMBER_FALLBACK_LENGTH = { min: 9, max: 11 } as const;

export const normalizeSaDigits = (value: string) => value.replace(/\D/g, '');

export const getBankByCode = (branchCode: string): SABank | undefined => {
  const code = normalizeSaDigits(branchCode.trim());

  if (!code) {
    return undefined;
  }

  return SA_BANKS.find((bank) => bank.code === code);
};

export const validateBranchCode = (branchCode: string): ValidationResult => {
  const code = normalizeSaDigits(branchCode.trim());

  if (!code) {
    return { valid: false, error: 'Enter a branch code' };
  }

  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: 'Branch code must be exactly 6 digits' };
  }

  if (!getBankByCode(code)) {
    return { valid: false, error: 'Unknown South African bank branch code' };
  }

  return { valid: true };
};

/**
 * Format-only account number validation.
 * Does not confirm account existence or ownership.
 */
export const validateAccountNumber = (
  accountNumber: string,
  branchCode?: string,
): ValidationResult => {
  const digits = normalizeSaDigits(accountNumber.trim());

  if (!digits) {
    return { valid: false, error: 'Enter a bank account number' };
  }

  // Allow spaces/dashes as formatting; reject letters and other symbols.
  if (/[^0-9\s-]/.test(accountNumber)) {
    return { valid: false, error: 'Account number must contain digits only' };
  }

  const bank = branchCode ? getBankByCode(branchCode) : undefined;
  const { min, max } = bank
    ? { min: bank.accountLengthMin, max: bank.accountLengthMax }
    : SA_ACCOUNT_NUMBER_FALLBACK_LENGTH;

  if (digits.length < min || digits.length > max) {
    if (min === max) {
      return {
        valid: false,
        error: bank
          ? `Account number for ${bank.name} must be ${min} digits`
          : `Account number must be ${min} digits`,
      };
    }

    return {
      valid: false,
      error: bank
        ? `Account number for ${bank.name} must be ${min}–${max} digits`
        : `Account number must be ${min}–${max} digits`,
    };
  }

  return { valid: true };
};

/** Zod-friendly helpers that return an error message or null. */
export const saBranchCodeError = (branchCode: string): string | null => {
  const result = validateBranchCode(branchCode);

  return result.valid ? null : (result.error ?? 'Invalid branch code');
};

export const saAccountNumberError = (
  accountNumber: string,
  branchCode?: string,
): string | null => {
  const result = validateAccountNumber(accountNumber, branchCode);

  return result.valid ? null : (result.error ?? 'Invalid account number');
};
