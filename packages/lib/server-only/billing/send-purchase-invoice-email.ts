import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import PurchaseInvoiceEmailTemplate from '@documenso/email/templates/purchase-invoice';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { sendResellerSaleInvoiceEmail } from '../reseller/send-reseller-sale-invoice-email';
import { getAdminNotificationRecipients } from '../user/get-admin-notification-recipients';
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
        filename: `${invoice.issuer === 'RESELLER' ? 'reseller' : 'nomia'}-invoice-${invoice.invoiceNumber ?? invoice.invoiceId}.pdf`,
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
      invoiceId: invoice.invoiceNumber ?? '—',
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
  const customerSubject = isSplitPurchase
    ? i18n._(msg`Your Nomia invoices for ${totalCredits} credits total`)
    : i18n._(msg`Your Nomia invoice for ${totalCredits} credits`);
  const from = {
    name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Nomia',
    address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@nomiadocs.com',
  };

  await mailer.sendMail({
    to: [
      {
        name: toName,
        address: toEmail,
      },
    ],
    from,
    subject: customerSubject,
    html,
    text,
    attachments,
  });

  const buyerEmailNormalised = toEmail.trim().toLowerCase();

  // Platform admin notification (separate from reseller sale invoice).
  // Skip admins who already received the buyer mail — that must NOT suppress
  // the dedicated reseller sale email below (admin+reseller owners still get it).
  const adminRecipients = (await getAdminNotificationRecipients()).filter(
    (admin) => admin.email !== buyerEmailNormalised,
  );

  if (adminRecipients.length > 0) {
    const adminSubject = isSplitPurchase
      ? i18n._(
          msg`Admin copy: invoices for ${organisation.name} (${totalCredits} credits total)`,
        )
      : i18n._(msg`Admin copy: invoice for ${organisation.name} (${totalCredits} credits)`);

    await mailer
      .sendMail({
        to: adminRecipients.map((admin) => ({
          name: admin.name || 'Nomia Admin',
          address: admin.email,
        })),
        from,
        subject: adminSubject,
        html,
        text,
        attachments,
      })
      .catch((error) => {
        console.error('[INVOICE]: Failed to send admin invoice copy', error);
      });
  }

  // Dedicated reseller sale invoice — always, even when the reseller owner is
  // also an admin (and even when their email matches the buyer / was skipped above).
  let resellerSaleEmailsSent = 0;

  for (const invoice of invoices) {
    if (invoice.issuer !== 'RESELLER' || !invoice.invoiceId.startsWith('reseller_')) {
      continue;
    }

    const transactionId = invoice.invoiceId.slice('reseller_'.length);

    const transaction = await prisma.resellerCreditTransaction.findUnique({
      where: { id: transactionId },
      select: {
        resellerOrganisationId: true,
      },
    });

    if (!transaction?.resellerOrganisationId) {
      continue;
    }

    const resellerResult = await sendResellerSaleInvoiceEmail({
      resellerOrganisationId: transaction.resellerOrganisationId,
      transactionId,
    }).catch((error) => {
      console.error('[INVOICE]: Failed to send reseller sale invoice email', error);
      return null;
    });

    if (resellerResult?.sent) {
      resellerSaleEmailsSent += 1;
    }
  }

  return {
    sent: true as const,
    invoiceIds: invoices.map((invoice) => invoice.invoiceId),
    adminCopiesSent: adminRecipients.length,
    resellerSaleEmailsSent,
  };
};
