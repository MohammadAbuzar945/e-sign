import type { Browser } from 'playwright';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { env } from '../../utils/env';
import {
  formatAmount,
  type OrganisationPurchaseHistoryItem,
} from './get-organisation-purchase-history';
import { resolvePurchaseInvoicePolicy } from './purchase-invoice-policy';

export { getOrganisationPurchaseInvoice, resolveResellerInvoiceLogoDataUrl } from './organisation-purchase-invoice';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const formatAddressHtml = (address: string | null | undefined) =>
  address ? escapeHtml(address).replaceAll('\n', '<br />') : null;

export const buildPurchaseInvoiceHtml = ({
  invoice,
  organisationName,
  customerName,
  customerEmail,
  logoUrl = '/android-chrome-512x512.png',
  resellerLogoUrl,
}: {
  invoice: OrganisationPurchaseHistoryItem;
  organisationName: string;
  customerName: string | null;
  customerEmail: string;
  logoUrl?: string;
  resellerLogoUrl?: string | null;
}) => {
  const issuedAt = new Date(invoice.date).toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const issuer =
    invoice.issuer ??
    (invoice.lineItems.some((line) => line.provider === 'reseller') &&
    !invoice.lineItems.some((line) => line.provider === 'nomia')
      ? 'RESELLER'
      : 'NOMIA');

  const policy = resolvePurchaseInvoicePolicy({
    issuer,
    amountInCents: invoice.totalGrossAmount,
    sellerVatStatus: invoice.resellerSeller?.vatStatus,
    sellerVatNumber: invoice.resellerSeller?.vatNumber,
    buyerVatNumber: invoice.buyerVatNumber,
    resellerDisplayName: invoice.resellerSeller?.name,
    resellerPhysicalAddress: invoice.resellerSeller?.physicalAddress,
  });

  const showVatColumns = policy.showVatColumns;
  const vatRatePercent = `${(policy.vatRate * 100).toFixed(0)}%`;

  const lineRows = invoice.lineItems
    .map((line) => {
      const linePolicy = resolvePurchaseInvoicePolicy({
        issuer: line.provider === 'reseller' ? 'RESELLER' : 'NOMIA',
        amountInCents: line.grossAmount,
        sellerVatStatus:
          line.provider === 'reseller' ? invoice.resellerSeller?.vatStatus : 'REGISTERED',
        sellerVatNumber:
          line.provider === 'reseller' ? invoice.resellerSeller?.vatNumber : undefined,
        resellerDisplayName: invoice.resellerSeller?.name,
        resellerPhysicalAddress: invoice.resellerSeller?.physicalAddress,
      });

      return `
        <tr>
          <td>${escapeHtml(line.provider === 'reseller' ? 'Reseller' : 'Nomia')}</td>
          <td>${escapeHtml(line.description)}</td>
          <td class="num">${line.credits}</td>
          ${
            showVatColumns
              ? `<td class="num">${escapeHtml(formatAmount(line.currency, linePolicy.netAmountInCents))}</td>
                 <td class="num">${escapeHtml(formatAmount(line.currency, linePolicy.vatAmountInCents))}</td>`
              : ''
          }
          <td class="num">${escapeHtml(formatAmount(line.currency, linePolicy.grossAmountInCents))}</td>
          <td>${escapeHtml(line.status)}</td>
          <td class="ref">${escapeHtml(line.reference ?? '—')}</td>
        </tr>
      `;
    })
    .join('');

  const supplierAddressHtml = formatAddressHtml(policy.supplier.address);
  const supplierVatLabel =
    policy.supplier.vatStatus === 'REGISTERED' && policy.supplier.vatNumber
      ? `VAT number — ${policy.supplier.vatNumber}`
      : policy.supplier.vatStatus === 'REGISTERED'
        ? 'VAT registered'
        : policy.supplier.vatStatus === 'NOT_REGISTERED'
          ? 'Not VAT registered'
          : null;

  const showResellerLogo = issuer === 'RESELLER' && Boolean(resellerLogoUrl);

  const supplierBlock = `
      <div class="seller">
        ${
          showResellerLogo
            ? `<img class="seller-logo" src="${escapeHtml(resellerLogoUrl!)}" alt="${escapeHtml(
                policy.supplier.name,
              )}" />`
            : ''
        }
        <strong>Supplier</strong><br />
        ${escapeHtml(policy.supplier.name)}
        ${supplierAddressHtml ? `<br /><span class="muted">${supplierAddressHtml}</span>` : ''}
        ${supplierVatLabel ? `<br /><span class="muted">${escapeHtml(supplierVatLabel)}</span>` : ''}
      </div>
    `;

  const buyerVatBlock = policy.buyerVatNumber
    ? `<br /><span class="muted">Buyer VAT number — ${escapeHtml(policy.buyerVatNumber)}</span>`
    : '';

  const buyerBillingAddressHtml = formatAddressHtml(invoice.buyerBillingAddress);

  const buyerAddressBlock = buyerBillingAddressHtml
    ? `<br /><span class="muted">${buyerBillingAddressHtml}</span>`
    : '';

  const totalsVatBlock = showVatColumns
    ? `
        <div><span>Net (${policy.pricingMode === 'INCLUSIVE' ? 'ex VAT' : 'exclusive'})</span><span>${escapeHtml(
          formatAmount(invoice.currency, policy.netAmountInCents),
        )}</span></div>
        <div><span>VAT (${vatRatePercent})</span><span>${escapeHtml(
          formatAmount(invoice.currency, policy.vatAmountInCents),
        )}</span></div>
      `
    : '';

  const pricePerCreditCents =
    invoice.totalCredits > 0
      ? Math.round(policy.grossAmountInCents / invoice.totalCredits)
      : null;

  const pricePerCreditBlock =
    pricePerCreditCents !== null
      ? `<div><span>Price per credit</span><span>${escapeHtml(
          formatAmount(invoice.currency, pricePerCreditCents),
        )}</span></div>`
      : '';

  const requiredNoteHtml = policy.requiredNote
    ? `<p class="note">${escapeHtml(policy.requiredNote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(policy.documentTitle)} ${escapeHtml(invoice.invoiceId)}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 16mm;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        min-height: 297mm;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        font-size: 12px;
        line-height: 1.45;
        background: #ffffff;
      }

      .page {
        width: 100%;
        min-height: 261mm;
      }

      .brand-logo {
        display: block;
        width: auto;
        height: 42px;
        margin-bottom: 20px;
      }

      .logo-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }

      .logo-row .brand-logo {
        margin-bottom: 0;
      }

      .seller-logo {
        display: block;
        width: auto;
        max-width: 160px;
        max-height: 56px;
        object-fit: contain;
        margin-bottom: 10px;
      }

      h1 {
        margin: 0 0 4px;
        font-size: 24px;
      }

      .muted {
        color: #6b7280;
        margin: 0;
      }

      .note {
        margin-top: 16px;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
        color: #374151;
      }

      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-top: 28px;
      }

      .meta-row .right {
        text-align: right;
      }

      .seller {
        margin-top: 20px;
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
      }

      .title {
        margin-top: 22px;
        font-weight: 700;
        font-size: 13px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
      }

      th, td {
        border-bottom: 1px solid #e5e7eb;
        padding: 9px 8px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f3f4f6;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      td.num, th.num {
        text-align: right;
        white-space: nowrap;
      }

      td.ref {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        word-break: break-all;
      }

      .totals {
        margin-top: 24px;
        width: 300px;
        margin-left: auto;
      }

      .totals div {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
      }

      .totals .grand {
        font-weight: 700;
        font-size: 16px;
        border-top: 2px solid #111827;
        margin-top: 6px;
        padding-top: 10px;
      }

      .footer {
        margin-top: 36px;
        color: #6b7280;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="logo-row">
        <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Nomia" />
        ${
          showResellerLogo
            ? `<img class="brand-logo" src="${escapeHtml(resellerLogoUrl!)}" alt="${escapeHtml(
                policy.supplier.name,
              )}" />`
            : ''
        }
      </div>
      <h1>${escapeHtml(policy.documentTitle)}</h1>
      <p class="muted">${escapeHtml(policy.issuedBySubtitle)}</p>
      ${
        showVatColumns
          ? `<p class="muted">VAT pricing: ${escapeHtml(policy.pricingMode.toLowerCase())}</p>`
          : ''
      }

      <div class="meta-row">
        <div>
          <strong>Bill to</strong><br />
          ${escapeHtml(organisationName)}<br />
          ${escapeHtml(customerName ?? customerEmail)}<br />
          ${escapeHtml(customerEmail)}
          ${buyerAddressBlock}
          ${buyerVatBlock}
        </div>
        <div class="right">
          <div><strong>Invoice #</strong> ${escapeHtml(invoice.invoiceId)}</div>
          <div><strong>Date</strong> ${escapeHtml(issuedAt)}</div>
          <div><strong>Status</strong> ${escapeHtml(invoice.status)}</div>
          <div><strong>Type</strong> ${escapeHtml(invoice.kind)}</div>
        </div>
      </div>

      ${supplierBlock}

      <p class="title">${escapeHtml(invoice.title)}</p>

      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Description</th>
            <th class="num">Credits</th>
            ${
              showVatColumns
                ? `<th class="num">Net</th><th class="num">VAT</th>`
                : ''
            }
            <th class="num">${showVatColumns ? 'Gross' : 'Amount'}</th>
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
        ${pricePerCreditBlock}
        ${totalsVatBlock}
        <div class="grand">
          <span>Total ${showVatColumns ? 'gross' : 'paid'}</span>
          <span>${escapeHtml(formatAmount(invoice.currency, policy.grossAmountInCents))}</span>
        </div>
      </div>

      ${requiredNoteHtml}

      <p class="footer">
        This document summarises your e-sign credit purchase. Split orders may produce separate
        Nomia and reseller invoices.
      </p>
    </div>
  </body>
</html>`;
};

export const buildPurchaseInvoicePdf = async ({
  html,
}: {
  html: string;
}): Promise<Uint8Array> => {
  const { chromium } = await import('playwright');

  let browser: Browser;
  const browserlessUrl = env('NEXT_PRIVATE_BROWSERLESS_URL');

  if (browserlessUrl) {
    browser = await chromium.connectOverCDP(browserlessUrl);
  } else {
    browser = await chromium.launch({
      executablePath: env('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH') || undefined,
    });
  }

  if (!browser) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to start PDF renderer for invoice',
    });
  }

  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 15_000,
    });

    await page.waitForSelector('h1', {
      state: 'visible',
      timeout: 10_000,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    });

    return pdf;
  } finally {
    await browserContext.close();
    void browser.close();
  }
};
