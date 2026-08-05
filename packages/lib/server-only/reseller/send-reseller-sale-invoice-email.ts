import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import ResellerSaleInvoiceEmailTemplate from '@documenso/email/templates/reseller-sale-invoice';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import {
  buildPurchaseInvoiceHtml,
  buildPurchaseInvoicePdf,
} from '../billing/build-purchase-invoice';
import { formatAmount } from '../billing/get-organisation-purchase-history';
import { getResellerSaleInvoice } from '../billing/get-reseller-sale-invoice';
import { resolveResellerPurchaseInvoiceId } from '../billing/record-organisation-credit-purchase';

export type SendResellerSaleInvoiceEmailOptions = {
  resellerOrganisationId: string;
  transactionId: string;
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

/**
 * Sends the reseller a dedicated sale-invoice email (separate from the buyer's mail — not a CC).
 */
export const sendResellerSaleInvoiceEmail = async ({
  resellerOrganisationId,
  transactionId,
  recipientEmail,
  recipientName,
}: SendResellerSaleInvoiceEmailOptions) => {
  const invoiceId = resolveResellerPurchaseInvoiceId({ transactionId });

  const {
    invoice,
    organisation: purchaserOrganisation,
    resellerLogoUrl,
    purchaserName,
    purchaserEmail,
  } = await getResellerSaleInvoice({
    resellerOrganisationId,
    invoiceId,
  });

  const resellerOrganisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: resellerOrganisationId },
    select: {
      name: true,
      url: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      resellerProfile: {
        select: {
          contactEmail: true,
        },
      },
    },
  });

  const toEmail =
    recipientEmail?.trim() ||
    resellerOrganisation.resellerProfile?.contactEmail?.trim() ||
    resellerOrganisation.owner.email;

  const toName =
    recipientName?.trim() ||
    resellerOrganisation.owner.name ||
    resellerOrganisation.name ||
    toEmail;

  if (!toEmail) {
    return { sent: false as const, reason: 'NO_RECIPIENT' as const };
  }

  const logoUrl = await getInvoiceLogoDataUrl();
  const htmlDocument = buildPurchaseInvoiceHtml({
    invoice,
    organisationName: purchaserOrganisation.name,
    customerName: purchaserName || purchaserOrganisation.owner.name,
    customerEmail: purchaserEmail || purchaserOrganisation.owner.email,
    logoUrl,
    resellerLogoUrl,
  });
  const pdf = await buildPurchaseInvoicePdf({ html: htmlDocument });

  const amountLabel = formatAmount(invoice.currency, invoice.totalGrossAmount);
  const salesHistoryUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${resellerOrganisation.url}/settings/reseller`;

  const emailContent = createElement(ResellerSaleInvoiceEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    resellerOrganisationName: resellerOrganisation.name,
    purchaserName: purchaserName || purchaserOrganisation.owner.name || purchaserEmail,
    purchaserEmail: purchaserEmail || purchaserOrganisation.owner.email,
    purchaserOrganisationName: purchaserOrganisation.name,
    invoiceId: invoice.invoiceId,
    invoiceTitle: invoice.title,
    credits: invoice.totalCredits,
    amountLabel,
    salesHistoryUrl,
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
    subject: i18n._(
      msg`Sale invoice: ${purchaserOrganisation.name} purchased ${invoice.totalCredits} credits`,
    ),
    html,
    text,
    attachments: [
      {
        filename: `reseller-invoice-${invoice.invoiceId}.pdf`,
        content: Buffer.from(pdf),
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    sent: true as const,
    invoiceId: invoice.invoiceId,
    recipientEmail: toEmail,
  };
};
