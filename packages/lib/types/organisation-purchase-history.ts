import type { FindResultResponse } from '@documenso/lib/types/search-params';

export const DEFAULT_PURCHASE_HISTORY_PER_PAGE = 20;

export type PurchaseHistoryLineItem = {
  provider: 'nomia' | 'reseller';
  description: string;
  credits: number;
  grossAmount: number;
  currency: string;
  status: string;
  reference: string | null;
};

export type PurchaseInvoiceResellerSeller = {
  name: string;
  physicalAddress: string | null;
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED' | null;
  vatNumber: string | null;
  affiliateSlug: string;
  hasLogo: boolean;
};

export type OrganisationPurchaseHistoryItem = {
  invoiceId: string;
  purchaseGroupId: string | null;
  date: Date;
  kind: 'subscription' | 'pay_as_you_go' | 'reseller' | 'bulk';
  /** Who issues / supplies this invoice document. */
  issuer: 'NOMIA' | 'RESELLER';
  title: string;
  totalCredits: number;
  totalGrossAmount: number;
  currency: string;
  status: string;
  lineItems: PurchaseHistoryLineItem[];
  /** Present when this invoice is issued by a reseller. */
  resellerSeller?: PurchaseInvoiceResellerSeller | null;
  /**
   * Buyer VAT number for tax invoices (Bill to) — Nomia and reseller issuers.
   * Prefer VAT-registered reseller profile; otherwise organisation.vatNumber.
   */
  buyerVatNumber?: string | null;
  /** Purchaser billing address for invoice Bill to (Nomia and reseller). */
  buyerBillingAddress?: string | null;
};

export type OrganisationPurchaseHistoryResult =
  FindResultResponse<OrganisationPurchaseHistoryItem[]>;
