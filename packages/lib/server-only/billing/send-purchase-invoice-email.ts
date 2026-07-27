import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import PurchaseInvoiceEmailTemplate from '@documenso/email/templates/purchase-invoice';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import {
  buildPurchaseInvoiceHtml,
  buildPurchaseInvoicePdf,
} from './build-purchase-invoice';
import { formatAmount } from './get-organisation-purchase-history';
import { getOrganisationPurchaseInvoicesForEmail } from './organisation-purchase-invoice';

export type SendPurchaseInvoiceEmailOptions = {
  organisationId: string;
  /** Single invoice (non-split purchases). */
  invoiceId?: string;
  /** Explicit invoice IDs when known. */
  invoiceIds?: string[];
  /**
   * Hybrid / split purchases: attach every invoice in the group in one email.
   * Preferred over a single `invoiceId` when set.
   */
  purchaseGroupId?: string | null;
  recipientEmail?: string;
  recipientName?: string | null;
};

const getInvoiceLogoDataUrl = async () => {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'android-chrome-512x512.png');
    const logoBytes = await readFile(logoPath);

    return `data:image/png;base64,${logoBytes.toString('base64')}`;
  } catch {
    return `${NEXT_PUBLIC_WEBAPP_URL()}/android-chrome-512x512.png`;
  }
};

export const sendPurchaseInvoiceEmail = async ({
  organisationId,
  invoiceId,
  invoiceIds,
  purchaseGroupId,
  recipientEmail,
  recipientName,
}: SendPurchaseInvoiceEmailOptions) => {
  if (!invoiceId && !invoiceIds?.length && !purchaseGroupId) {
    return { sent: false as const, reason: 'NO_INVOICE' as const };
  }

  const { invoices, organisation, resellerLogoUrls } =
    await getOrganisationPurchaseInvoicesForEmail({
      organisationId,
      invoiceId,
      invoiceIds,
      purchaseGroupId,
    });

  const toEmail = recipientEmail ?? organisation.owner.email;
  const toName = recipientName ?? organisation.owner.name ?? toEmail;

  if (!toEmail) {
    return { sent: false as const, reason: 'NO_RECIPIENT' as const };
  }

  const logoUrl = await getInvoiceLogoDataUrl();
  const isSplitPurchase = invoices.length > 1;

  const attachments = await Promise.all(
    invoices.map(async (invoice, index) => {
      const htmlDocument = buildPurchaseInvoiceHtml({
        invoice,
        organisationName: organisation.name,
        customerName: toName,
        customerEmail: toEmail,
        logoUrl,
        resellerLogoUrl: resellerLogoUrls[index],
      });
      const pdf = await buildPurchaseInvoicePdf({ html: htmlDocument });

      return {
        filename: `${invoice.issuer === 'RESELLER' ? 'reseller' : 'nomia'}-invoice-${invoice.invoiceId}.pdf`,
        content: Buffer.from(pdf),
        contentType: 'application/pdf',
      };
    }),
  );

  const totalCredits = invoices.reduce((sum, invoice) => sum + invoice.totalCredits, 0);
  const totalGrossAmount = invoices.reduce((sum, invoice) => sum + invoice.totalGrossAmount, 0);
  const currency = invoices[0]?.currency ?? 'ZAR';
  const totalAmountLabel = formatAmount(currency, totalGrossAmount);
  const purchaseHistoryUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${organisation.url}/price-plan`;

  const emailContent = createElement(PurchaseInvoiceEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    customerName: toName,
    organisationName: organisation.name,
    invoices: invoices.map((invoice) => ({
      invoiceTitle: invoice.title,
      invoiceId: invoice.invoiceId,
      credits: invoice.totalCredits,
      amountLabel: formatAmount(invoice.currency, invoice.totalGrossAmount),
    })),
    totalCredits,
    totalAmountLabel,
    purchaseHistoryUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  const i18n = await getI18nInstance('en');
  const subject = isSplitPurchase
    ? i18n._(msg`Your Nomia invoices for ${totalCredits} credits total`)
    : i18n._(msg`Your Nomia invoice for ${totalCredits} credits`);

  await mailer.sendMail({
    to: [
      {
        name: toName,
        address: toEmail,
      },
    ],
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Nomia',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@nomiadocs.com',
    },
    subject,
    html,
    text,
    attachments,
  });

  return {
    sent: true as const,
    invoiceIds: invoices.map((invoice) => invoice.invoiceId),
  };
};
