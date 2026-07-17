import type { Browser } from 'playwright';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { env } from '../../utils/env';
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
        url: true,
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
          <td class="num">${line.credits}</td>
          <td class="num">${escapeHtml(formatAmount(line.currency, line.grossAmount))}</td>
          <td>${escapeHtml(line.status)}</td>
          <td class="ref">${escapeHtml(line.reference ?? '—')}</td>
        </tr>
      `,
    )
    .join('');

  const resellerSeller = invoice.resellerSeller;
  const resellerVatLabel = (() => {
    if (!resellerSeller) {
      return null;
    }

    if (resellerSeller.vatStatus === 'REGISTERED' && resellerSeller.vatNumber) {
      return `VAT registered — ${resellerSeller.vatNumber}`;
    }

    if (resellerSeller.vatStatus === 'REGISTERED') {
      return 'VAT registered';
    }

    if (resellerSeller.vatStatus === 'NOT_REGISTERED') {
      return 'Not VAT registered';
    }

    if (resellerSeller.vatNumber) {
      return `VAT number — ${resellerSeller.vatNumber}`;
    }

    return null;
  })();

  const resellerAddressHtml = resellerSeller?.physicalAddress
    ? escapeHtml(resellerSeller.physicalAddress).replaceAll('\n', '<br />')
    : null;

  const resellerSellerBlock = resellerSeller
    ? `
      <div class="seller">
        <strong>Reseller (seller)</strong><br />
        ${escapeHtml(resellerSeller.name)}
        ${resellerAddressHtml ? `<br /><span class="muted">${resellerAddressHtml}</span>` : ''}
        ${resellerVatLabel ? `<br /><span class="muted">${escapeHtml(resellerVatLabel)}</span>` : ''}
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeHtml(invoice.invoiceId)}</title>
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

      h1 {
        margin: 0 0 4px;
        font-size: 24px;
      }

      .muted {
        color: #6b7280;
        margin: 0;
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
        width: 280px;
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
      <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Nomia" />
      <h1>Tax Invoice</h1>
      <p class="muted">${
        resellerSeller
          ? `Issued via Nomia on behalf of ${escapeHtml(resellerSeller.name)}`
          : 'Issued by Nomia'
      }</p>

      <div class="meta-row">
        <div>
          <strong>Bill to</strong><br />
          ${escapeHtml(organisationName)}<br />
          ${escapeHtml(customerName ?? customerEmail)}<br />
          ${escapeHtml(customerEmail)}
        </div>
        <div class="right">
          <div><strong>Invoice #</strong> ${escapeHtml(invoice.invoiceId)}</div>
          <div><strong>Date</strong> ${escapeHtml(issuedAt)}</div>
          <div><strong>Status</strong> ${escapeHtml(invoice.status)}</div>
          <div><strong>Type</strong> ${escapeHtml(invoice.kind)}</div>
        </div>
      </div>

      ${resellerSellerBlock}

      <p class="title">${escapeHtml(invoice.title)}</p>

      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Description</th>
            <th class="num">Credits</th>
            <th class="num">Amount</th>
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

      <p class="footer">
        This invoice summarises your e-sign credit purchase. For split purchases, credits may be
        fulfilled by both a reseller and Nomia.
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
      waitUntil: 'networkidle',
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
