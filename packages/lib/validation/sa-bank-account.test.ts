import { describe, expect, it } from 'vitest';

import {
  getBankByCode,
  validateAccountNumber,
  validateBranchCode,
} from './sa-bank-account';

describe('getBankByCode', () => {
  it('returns the bank for a known universal branch code', () => {
    expect(getBankByCode('470010')?.name).toBe('Capitec Bank');
    expect(getBankByCode('250655')?.name).toBe('FNB');
  });

  it('returns undefined for an unknown code', () => {
    expect(getBankByCode('999999')).toBeUndefined();
  });
});

describe('validateBranchCode', () => {
  it('accepts a known 6-digit universal branch code', () => {
    expect(validateBranchCode('632005')).toEqual({ valid: true });
  });

  it('rejects non-numeric and wrong-length codes', () => {
    expect(validateBranchCode('63200A').valid).toBe(false);
    expect(validateBranchCode('63200').error).toMatch(/exactly 6 digits/i);
    expect(validateBranchCode('6320055').error).toMatch(/exactly 6 digits/i);
  });

  it('rejects an unknown branch code', () => {
    expect(validateBranchCode('999999').error).toMatch(/Unknown/i);
  });
});

describe('validateAccountNumber', () => {
  it('accepts a valid account number with a matching branch code', () => {
    expect(validateAccountNumber('1234567890', '470010')).toEqual({ valid: true });
  });

  it('rejects a valid-looking number when length mismatches the selected bank', () => {
    // Capitec expects exactly 10 digits.
    expect(validateAccountNumber('123456789', '470010').error).toMatch(/Capitec.*10 digits/i);
    expect(validateAccountNumber('12345678901', '470010').error).toMatch(/Capitec.*10 digits/i);
  });

  it('rejects letters and symbols', () => {
    expect(validateAccountNumber('12345abc90').error).toMatch(/digits only/i);
    expect(validateAccountNumber('1234567890!').error).toMatch(/digits only/i);
  });

  it('rejects account numbers that are too short or too long without a bank', () => {
    expect(validateAccountNumber('12345678').error).toMatch(/9–11 digits/i);
    expect(validateAccountNumber('123456789012').error).toMatch(/9–11 digits/i);
  });

  it('accepts 9–11 digit accounts when no branch code is provided', () => {
    expect(validateAccountNumber('123456789')).toEqual({ valid: true });
    expect(validateAccountNumber('12345678901')).toEqual({ valid: true });
  });

  it('uses fallback length rules for an unknown branch code', () => {
    expect(validateAccountNumber('1234567890', '999999')).toEqual({ valid: true });
    expect(validateAccountNumber('12345678', '999999').error).toMatch(/9–11 digits/i);
  });
});
