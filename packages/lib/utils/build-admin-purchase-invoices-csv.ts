export type AdminPurchaseInvoiceCsvRow = {
  invoiceId: string;
  kind: 'BULK' | 'PAYG' | 'SUBSCRIPTION';
  createdAt: Date;
  completedAt: Date | null;
  credits: number;
  grossAmount: number;
  currency: string;
  pricePerCreditCents: number;
  paystackReference: string | null;
  organisationName: string;
  organisationUrl: string;
  purchaserName: string | null;
  purchaserEmail: string;
  status: string;
};

const escapeCsvValue = (value: string) => {
  return `"${value.replace(/"/g, '""')}"`;
};

const formatCentsAsDecimal = (cents: number) => (cents / 100).toFixed(2);

const kindLabel = (kind: 'BULK' | 'PAYG' | 'SUBSCRIPTION') => {
  if (kind === 'BULK') {
    return 'Bulk inventory';
  }

  if (kind === 'SUBSCRIPTION') {
    return 'Subscription';
  }

  return 'Pay as you go';
};

export const buildAdminPurchaseInvoicesCsv = ({
  rows,
}: {
  rows: AdminPurchaseInvoiceCsvRow[];
}) => {
  const header = [
    'Date',
    'Invoice ID',
    'Type',
    'Organisation',
    'Organisation URL',
    'Purchaser Name',
    'Purchaser Email',
    'Credits',
    'Price Per Credit',
    'Gross Amount',
    'Currency',
    'Paystack Reference',
    'Status',
  ];

  const dataRows = rows.map((row) => {
    const date = row.completedAt ?? row.createdAt;

    return [
      date.toISOString(),
      row.invoiceId,
      kindLabel(row.kind),
      escapeCsvValue(row.organisationName),
      row.organisationUrl,
      escapeCsvValue(row.purchaserName ?? ''),
      row.purchaserEmail,
      row.credits.toString(),
      formatCentsAsDecimal(row.pricePerCreditCents),
      formatCentsAsDecimal(row.grossAmount),
      row.currency,
      row.paystackReference ?? '',
      row.status,
    ].join(',');
  });

  return [header.join(','), ...dataRows].join('\n');
};
