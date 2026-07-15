import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import {
  formatAmount,
  getOrganisationPurchaseHistory,
  type OrganisationPurchaseHistoryItem,
} from './get-organisation-purchase-history';

export const getOrganisationPurchaseInvoice = async ({
  organisationId,
  invoiceId,
}: {
  organisationId: string;
  invoiceId: string;
}) => {
  const history = await getOrganisationPurchaseHistory({ organisationId });
  const invoice = history.find((item) => item.invoiceId === invoiceId);

  if (!invoice) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const organisation = await import('@documenso/prisma').then(({ prisma }) =>
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: {
        name: true,
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  );

  return {
    invoice,
    organisation,
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const buildPurchaseInvoiceHtml = ({
  invoice,
  organisationName,
  customerName,
  customerEmail,
  logoUrl = '/android-chrome-512x512.png',
}: {
  invoice: OrganisationPurchaseHistoryItem;
  organisationName: string;
  customerName: string | null;
  customerEmail: string;
  logoUrl?: string;
}) => {
  const issuedAt = invoice.date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lineRows = invoice.lineItems
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.provider === 'reseller' ? 'Reseller' : 'Nomia')}</td>
          <td>${escapeHtml(line.description)}</td>
          <td style="text-align:right">${line.credits}</td>
          <td style="text-align:right">${escapeHtml(formatAmount(line.currency, line.grossAmount))}</td>
          <td>${escapeHtml(line.status)}</td>
          <td style="font-family:monospace;font-size:12px">${escapeHtml(line.reference ?? '—')}</td>
        </tr>
      `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeHtml(invoice.invoiceId)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
      .brand-logo { display: block; width: auto; height: 48px; margin-bottom: 28px; }
      h1 { margin-bottom: 4px; }
      .muted { color: #6b7280; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
      th { background: #f9fafb; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
      .totals { margin-top: 24px; width: 320px; margin-left: auto; }
      .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
      .totals .grand { font-weight: bold; font-size: 18px; border-top: 2px solid #111827; padding-top: 10px; }
      @media print { body { margin: 20px; } }
    </style>
  </head>
  <body>
    <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Nomia" />
    <h1>Tax Invoice</h1>
    <p class="muted">Issued by Nomia</p>

    <div style="display:flex;justify-content:space-between;margin-top:32px;gap:24px">
      <div>
        <strong>Bill to</strong><br />
        ${escapeHtml(organisationName)}<br />
        ${escapeHtml(customerName ?? customerEmail)}<br />
        ${escapeHtml(customerEmail)}
      </div>
      <div style="text-align:right">
        <div><strong>Invoice #</strong> ${escapeHtml(invoice.invoiceId)}</div>
        <div><strong>Date</strong> ${escapeHtml(issuedAt)}</div>
        <div><strong>Status</strong> ${escapeHtml(invoice.status)}</div>
        <div><strong>Type</strong> ${escapeHtml(invoice.kind)}</div>
      </div>
    </div>

    <p style="margin-top:24px"><strong>${escapeHtml(invoice.title)}</strong></p>

    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Description</th>
          <th style="text-align:right">Credits</th>
          <th style="text-align:right">Amount</th>
          <th>Status</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Total credits</span><span>${invoice.totalCredits}</span></div>
      <div class="grand">
        <span>Total paid</span>
        <span>${escapeHtml(formatAmount(invoice.currency, invoice.totalGrossAmount))}</span>
      </div>
    </div>

    <p class="muted" style="margin-top:40px">
      This invoice summarises your e-sign credit purchase. For split purchases, credits may be fulfilled by both a reseller and Nomia in separate Paystack transactions.
    </p>
  </body>
</html>`;
};
