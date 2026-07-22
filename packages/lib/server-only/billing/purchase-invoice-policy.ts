import {
  NOMIA_LEGAL_NAME,
  NOMIA_TAX_INVOICE_SEQUENCE_PREFIX,
  NOMIA_VAT_ADDRESS,
  NOMIA_VAT_NUMBER,
  NOMIA_VAT_PRICING_MODE,
  NOMIA_VAT_RATE,
  NON_VAT_SUPPLIER_INVOICE_NOTE,
  type NomiaVatPricingMode,
} from '@documenso/lib/constants/nomia-vat';
import {
  calculateVatBreakdownInCents,
  isSellerVatRegistered,
  type VatSellerStatus,
} from '@documenso/lib/utils/reseller-vat';

export type PurchaseInvoiceIssuer = 'NOMIA' | 'RESELLER';

export type PurchaseInvoiceDocumentTitle = 'Tax Invoice' | 'Invoice';

export type PurchaseInvoiceSupplier = {
  name: string;
  address: string | null;
  vatNumber: string | null;
  vatStatus: VatSellerStatus;
};

export type ResolvePurchaseInvoicePolicyInput = {
  issuer: PurchaseInvoiceIssuer;
  /** Gross paid today (inclusive mode) or net (when mode is exclusive). */
  amountInCents: number;
  sellerVatStatus?: VatSellerStatus;
  sellerVatNumber?: string | null;
  /**
   * Display-only on Nomia tax invoices when the buyer org is itself a
   * VAT-registered reseller. Never used to decide whether VAT is charged.
   */
  buyerVatNumber?: string | null;
  resellerDisplayName?: string | null;
  resellerPhysicalAddress?: string | null;
  pricingMode?: NomiaVatPricingMode;
};

export type PurchaseInvoicePolicy = {
  issuer: PurchaseInvoiceIssuer;
  documentTitle: PurchaseInvoiceDocumentTitle;
  pricingMode: NomiaVatPricingMode;
  showVatColumns: boolean;
  vatRate: number;
  netAmountInCents: number;
  vatAmountInCents: number;
  grossAmountInCents: number;
  requiredNote: string | null;
  supplier: PurchaseInvoiceSupplier;
  buyerVatNumber: string | null;
  issuedBySubtitle: string;
  sequencePrefix: string | null;
};

export const resolvePurchaseInvoicePolicy = ({
  issuer,
  amountInCents,
  sellerVatStatus,
  sellerVatNumber,
  buyerVatNumber,
  resellerDisplayName,
  resellerPhysicalAddress,
  pricingMode = NOMIA_VAT_PRICING_MODE,
}: ResolvePurchaseInvoicePolicyInput): PurchaseInvoicePolicy => {
  if (issuer === 'NOMIA') {
    const breakdown = calculateVatBreakdownInCents({
      amountInCents,
      sellerVatStatus: 'REGISTERED',
      vatNumber: NOMIA_VAT_NUMBER,
      pricingMode,
      vatRate: NOMIA_VAT_RATE,
    });

    return {
      issuer,
      documentTitle: 'Tax Invoice',
      pricingMode: breakdown.pricingMode,
      showVatColumns: true,
      vatRate: breakdown.vatRate,
      netAmountInCents: breakdown.netAmountInCents,
      vatAmountInCents: breakdown.vatAmountInCents,
      grossAmountInCents: breakdown.grossAmountInCents,
      requiredNote: null,
      supplier: {
        name: NOMIA_LEGAL_NAME,
        address: NOMIA_VAT_ADDRESS,
        vatNumber: NOMIA_VAT_NUMBER,
        vatStatus: 'REGISTERED',
      },
      buyerVatNumber: buyerVatNumber?.trim() || null,
      issuedBySubtitle: 'Issued by Nomia',
      sequencePrefix: NOMIA_TAX_INVOICE_SEQUENCE_PREFIX,
    };
  }

  const registered = isSellerVatRegistered({
    sellerVatStatus,
    vatNumber: sellerVatNumber,
  });

  const breakdown = calculateVatBreakdownInCents({
    amountInCents,
    sellerVatStatus: registered ? 'REGISTERED' : 'NOT_REGISTERED',
    vatNumber: sellerVatNumber,
    pricingMode,
    vatRate: NOMIA_VAT_RATE,
  });

  const supplierName = resellerDisplayName?.trim() || 'Reseller';

  if (registered) {
    return {
      issuer,
      documentTitle: 'Tax Invoice',
      pricingMode: breakdown.pricingMode,
      showVatColumns: true,
      vatRate: breakdown.vatRate,
      netAmountInCents: breakdown.netAmountInCents,
      vatAmountInCents: breakdown.vatAmountInCents,
      grossAmountInCents: breakdown.grossAmountInCents,
      requiredNote: null,
      supplier: {
        name: supplierName,
        address: resellerPhysicalAddress ?? null,
        vatNumber: sellerVatNumber?.trim() || null,
        vatStatus: 'REGISTERED',
      },
      buyerVatNumber: null,
      issuedBySubtitle: `Issued via Nomia on behalf of ${supplierName}`,
      sequencePrefix: null,
    };
  }

  return {
    issuer,
    documentTitle: 'Invoice',
    pricingMode: breakdown.pricingMode,
    showVatColumns: false,
    vatRate: 0,
    netAmountInCents: breakdown.netAmountInCents,
    vatAmountInCents: 0,
    grossAmountInCents: breakdown.grossAmountInCents,
    requiredNote: NON_VAT_SUPPLIER_INVOICE_NOTE,
    supplier: {
      name: supplierName,
      address: resellerPhysicalAddress ?? null,
      vatNumber: null,
      vatStatus: 'NOT_REGISTERED',
    },
    buyerVatNumber: null,
    issuedBySubtitle: `Issued via Nomia on behalf of ${supplierName}`,
    sequencePrefix: null,
  };
};
