import {
  calculateResellerNetAmountInCents,
  formatCentsAsDecimal,
  resolveResellerVatAmountInCents,
} from './reseller-vat';

export type ResellerTransactionCsvRow = {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  purchaserName: string;
  purchaserEmail: string;
  purchaserOrganisationName: string;
  credits: number;
  grossAmount: number;
  vatAmount: number;
  paystackFeeAmount?: number;
  currency: string;
  paystackReference: string | null;
  status: string;
  sellerVatStatus?: 'NOT_REGISTERED' | 'REGISTERED' | null;
  sellerVatNumber?: string | null;
};

const escapeCsvValue = (value: string) => {
  return `"${value.replace(/"/g, '""')}"`;
};

export const buildResellerTransactionsCsv = ({
  resellerOrganisationName,
  resellerVatNumber,
  resellerVatStatus,
  rows,
}: {
  resellerOrganisationName: string;
  resellerVatNumber?: string | null;
  resellerVatStatus?: 'NOT_REGISTERED' | 'REGISTERED' | null;
  rows: ResellerTransactionCsvRow[];
}) => {
  const header = [
    'Date',
    'Invoice ID',
    'Client Name',
    'Client Email',
    'Client Organisation',
    'Credits',
    'Gross Amount',
    'Paystack Fee',
    'VAT Amount',
    'Net Amount',
    'Currency',
    'Paystack Reference',
    'Status',
  ];

  const metadataRows = [
    ['Reseller', escapeCsvValue(resellerOrganisationName)],
    ['Reseller VAT Number', escapeCsvValue(resellerVatNumber?.trim() ?? '')],
    [],
  ];

  const dataRows = rows.map((row) => {
    const vatAmount = resolveResellerVatAmountInCents(
      row.grossAmount,
      row.vatAmount,
      row.sellerVatNumber ?? resellerVatNumber,
      row.sellerVatStatus ?? resellerVatStatus,
    );
    const netAmount = calculateResellerNetAmountInCents(row.grossAmount, vatAmount);
    const transactionDate = row.completedAt ?? row.createdAt;

    return [
      transactionDate.toISOString(),
      `reseller_${row.id}`,
      escapeCsvValue(row.purchaserName),
      row.purchaserEmail,
      escapeCsvValue(row.purchaserOrganisationName),
      row.credits.toString(),
      formatCentsAsDecimal(row.grossAmount),
      formatCentsAsDecimal(row.paystackFeeAmount ?? 0),
      formatCentsAsDecimal(vatAmount),
      formatCentsAsDecimal(netAmount),
      row.currency,
      row.paystackReference ?? '',
      row.status,
    ].join(',');
  });

  return [...metadataRows.map((row) => row.join(',')), header.join(','), ...dataRows].join('\n');
};
