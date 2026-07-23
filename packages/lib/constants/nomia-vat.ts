/**
 * Nomia (platform) tax-invoice identity for South Africa.
 * Update here when SARS / company registration details change.
 *
 * Invoices show legal name + VAT number only (no address, registration, or directors).
 */
export const NOMIA_LEGAL_NAME = 'Nomia Africa (Pty) Ltd';

export const NOMIA_TRADING_NAME = 'Nomia';

/** CIPC company registration number (not shown on invoices). */
export const NOMIA_COMPANY_REGISTRATION = '2016/132572/07';

/** South African VAT registration number for Nomia-issued tax invoices. */
export const NOMIA_VAT_NUMBER = '4070274966';

/** Directors list (not shown on invoices). */
export const NOMIA_DIRECTORS =
  'Jonathan Du Preez (CEO), Malcolm Mac Donald (CTO)';

/** Registered office address lines (not shown on invoices). */
export const NOMIA_OFFICE_ADDRESS_LINES = [
  '5A Tessa Road',
  'Riverclub, 2191',
  'South Africa',
] as const;

/**
 * Address block rendered on invoices — intentionally empty.
 * Name + VAT number are enough on the document for now.
 */
export const NOMIA_VAT_ADDRESS_LINES = [] as const;

/** Human-readable VAT address block for invoices. */
export const NOMIA_VAT_ADDRESS = NOMIA_VAT_ADDRESS_LINES.join('\n');

/**
 * How amounts on invoices are interpreted relative to VAT.
 * Inclusive today; switch to EXCLUSIVE when product pricing becomes ex-VAT.
 */
export type NomiaVatPricingMode = 'INCLUSIVE' | 'EXCLUSIVE';

export const NOMIA_VAT_PRICING_MODE: NomiaVatPricingMode = 'INCLUSIVE';

/** Standard SA VAT rate used for Nomia and VAT-registered reseller invoices. */
export const NOMIA_VAT_RATE = 0.15;

export const NON_VAT_SUPPLIER_INVOICE_NOTE =
  'Supplier is not registered for VAT. VAT has not been charged.';
