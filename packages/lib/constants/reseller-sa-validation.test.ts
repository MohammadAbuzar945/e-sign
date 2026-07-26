import { describe, expect, it } from 'vitest';

import {
  isValidSaIdentityNumber,
  isValidSaPassportNumber,
  normalizeSaPhoneNumber,
  validateSaBankAccountNumber,
  validateSaBusinessRegistrationNumber,
  validateSaIdentityNumber,
  validateSaPassportNumber,
  validateSaPhoneNumber,
  validateSaVatNumber,
} from '@documenso/lib/constants/reseller-sa-validation';

describe('SA identity number validation', () => {
  it('accepts a valid SA ID with correct checksum and date', () => {
    expect(isValidSaIdentityNumber('8001015009087')).toBe(true);
    expect(validateSaIdentityNumber('8001015009087')).toBeNull();
  });

  it('rejects IDs with an invalid checksum', () => {
    expect(isValidSaIdentityNumber('8001015009088')).toBe(false);
    expect(validateSaIdentityNumber('8001015009088')).toMatch(/valid South African ID/i);
  });

  it('rejects IDs with an impossible date', () => {
    expect(isValidSaIdentityNumber('8002315009087')).toBe(false);
    expect(validateSaIdentityNumber('8002315009087')).toMatch(/valid South African ID/i);
  });

  it('rejects IDs that are not 13 digits', () => {
    expect(validateSaIdentityNumber('80010150090')).toMatch(/exactly 13 digits/i);
  });
});

describe('SA passport number validation', () => {
  it('accepts 1 letter + 8 digits', () => {
    expect(isValidSaPassportNumber('A12345678')).toBe(true);
    expect(validateSaPassportNumber('a12345678')).toBeNull();
  });

  it('rejects invalid passport formats', () => {
    expect(isValidSaPassportNumber('12345678')).toBe(false);
    expect(validateSaPassportNumber('AB1234567')).toMatch(/1 letter followed by 8 digits/i);
  });
});

describe('SA phone number validation', () => {
  it('accepts local 0XXXXXXXXX format and normalizes to +27', () => {
    expect(normalizeSaPhoneNumber('0821234567')).toBe('+27821234567');
    expect(validateSaPhoneNumber('082 123 4567')).toBeNull();
  });

  it('accepts +27 and 27 international formats', () => {
    expect(normalizeSaPhoneNumber('+27821234567')).toBe('+27821234567');
    expect(normalizeSaPhoneNumber('27821234567')).toBe('+27821234567');
    expect(validateSaPhoneNumber('+27 82 123 4567')).toBeNull();
  });

  it('rejects non-SA formats', () => {
    expect(normalizeSaPhoneNumber('12345')).toBeNull();
    expect(normalizeSaPhoneNumber('+441234567890')).toBeNull();
    expect(validateSaPhoneNumber('12345')).toMatch(/South African phone/i);
  });
});

describe('SA bank account number validation', () => {
  it('enforces Capitec 10-digit account numbers by bank code', () => {
    expect(
      validateSaBankAccountNumber({
        bankCode: '470010',
        bankName: 'Capitec Bank',
        accountNumber: '1234567890',
      }),
    ).toBeNull();

    expect(
      validateSaBankAccountNumber({
        bankCode: '470010',
        bankName: 'Capitec Bank',
        accountNumber: '123456789',
      }),
    ).toMatch(/must be 10 digits/i);
  });

  it('matches FNB by name when code is unknown', () => {
    expect(
      validateSaBankAccountNumber({
        bankCode: 'unknown',
        bankName: 'First National Bank',
        accountNumber: '12345678901',
      }),
    ).toBeNull();

    expect(
      validateSaBankAccountNumber({
        bankCode: 'unknown',
        bankName: 'First National Bank',
        accountNumber: '1234567890',
      }),
    ).toMatch(/must be 11 digits/i);
  });

  it('falls back to 9–11 digits for unknown banks', () => {
    expect(
      validateSaBankAccountNumber({
        bankCode: '999999',
        bankName: 'Some Community Bank',
        accountNumber: '123456789',
      }),
    ).toBeNull();

    expect(
      validateSaBankAccountNumber({
        bankCode: '999999',
        bankName: 'Some Community Bank',
        accountNumber: '1234567',
      }),
    ).toMatch(/9–11 digits/i);
  });

  it('strips spaces and dashes before validating', () => {
    expect(
      validateSaBankAccountNumber({
        bankCode: '470010',
        bankName: 'Capitec',
        accountNumber: '1234-567-890',
      }),
    ).toBeNull();
  });
});

describe('SA business registration number validation', () => {
  it('accepts CIPC-style registration numbers', () => {
    expect(validateSaBusinessRegistrationNumber('2020/123456/07')).toBeNull();
  });

  it('rejects overly short values', () => {
    expect(validateSaBusinessRegistrationNumber('12')).toMatch(/valid business registration/i);
  });
});

describe('SA VAT number validation', () => {
  it('accepts a valid 10-digit VAT number starting with 4', () => {
    expect(validateSaVatNumber('4123456789')).toBeNull();
    expect(validateSaVatNumber('4070274966')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(validateSaVatNumber('412345678a')).toMatch(/digits only/i);
    expect(validateSaVatNumber('4ABCDEFGHI')).toMatch(/digits only/i);
  });

  it('rejects wrong length', () => {
    expect(validateSaVatNumber('412345678')).toMatch(/exactly 10 digits/i);
    expect(validateSaVatNumber('41234567890')).toMatch(/exactly 10 digits/i);
  });

  it('rejects numbers that do not start with 4', () => {
    expect(validateSaVatNumber('3123456789')).toMatch(/start with 4/i);
    expect(validateSaVatNumber('0123456789')).toMatch(/start with 4/i);
  });

  it('rejects empty values', () => {
    expect(validateSaVatNumber('')).toMatch(/Enter a VAT/i);
  });
});
