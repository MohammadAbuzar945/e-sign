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
  getOrganisationPurchaseInvoice,
} from './build-purchase-invoice';
import { formatAmount } from './get-organisation-purchase-history';

export type SendPurchaseInvoiceEmailOptions = {
  organisationId: string;
  invoiceId: string;
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
  recipientEmail,
  recipientName,
}: SendPurchaseInvoiceEmailOptions) => {
  const { invoice, organisation } = await getOrganisationPurchaseInvoice({
    organisationId,
    invoiceId,
  });

  const toEmail = recipientEmail ?? organisation.owner.email;
  const toName = recipientName ?? organisation.owner.name ?? toEmail;

  if (!toEmail) {
    return { sent: false as const, reason: 'NO_RECIPIENT' as const };
  }

  const logoUrl = await getInvoiceLogoDataUrl();
  const htmlDocument = buildPurchaseInvoiceHtml({
    invoice,
    organisationName: organisation.name,
    customerName: toName,
    customerEmail: toEmail,
    logoUrl,
  });
  const pdf = await buildPurchaseInvoicePdf({ html: htmlDocument });

  const purchaseHistoryUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${organisation.url}/price-plan`;
  const amountLabel = formatAmount(invoice.currency, invoice.totalGrossAmount);

  const emailContent = createElement(PurchaseInvoiceEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    customerName: toName,
    organisationName: organisation.name,
    invoiceTitle: invoice.title,
    invoiceId: invoice.invoiceId,
    credits: invoice.totalCredits,
    amountLabel,
    purchaseHistoryUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  const i18n = await getI18nInstance('en');

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
    subject: i18n._(msg`Your Nomia invoice for ${invoice.totalCredits} credits`),
    html,
    text,
    attachments: [
      {
        filename: `nomia-invoice-${invoice.invoiceId}.pdf`,
        content: Buffer.from(pdf),
        contentType: 'application/pdf',
      },
    ],
  });

  return { sent: true as const, invoiceId: invoice.invoiceId };
};
