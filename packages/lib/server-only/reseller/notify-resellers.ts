import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import ResellerAdminBroadcastEmailTemplate from '@documenso/email/templates/reseller-admin-broadcast';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getResellerNotifyRecipients } from './get-reseller-notify-recipients';
import {
  sanitizeResellerBroadcastHtml,
  stripHtmlToPlainText,
} from './sanitize-reseller-broadcast-html';

const PREVIEW_RECIPIENT_NAME = 'Reseller Partner';

export type PreviewResellerBroadcastOptions = {
  subject: string;
  htmlBody: string;
};

export type NotifyResellersOptions = {
  subject: string;
  htmlBody: string;
  adminUserId: number;
};

const getSender = () => ({
  name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Nomia',
  address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@nomiadocs.com',
});

const renderBroadcastEmail = async ({
  subject,
  htmlBody,
  recipientName,
}: {
  subject: string;
  htmlBody: string;
  recipientName: string;
}) => {
  const trimmedSubject = subject.trim();

  if (!trimmedSubject) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Subject is required',
      userMessage: 'Please enter an email subject.',
    });
  }

  let safeHtml: string;

  try {
    safeHtml = sanitizeResellerBroadcastHtml(htmlBody);
  } catch (error) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: error instanceof Error ? error.message : 'Invalid HTML body',
      userMessage:
        error instanceof Error ? error.message : 'Please provide a valid HTML message body.',
    });
  }

  const emailContent = createElement(ResellerAdminBroadcastEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    recipientName,
    subject: trimmedSubject,
    htmlBody: safeHtml,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  return {
    html,
    text: text || stripHtmlToPlainText(safeHtml),
    subject: trimmedSubject,
    safeHtml,
  };
};

export const previewResellerBroadcast = async ({
  subject,
  htmlBody,
}: PreviewResellerBroadcastOptions) => {
  const recipients = await getResellerNotifyRecipients();
  const rendered = await renderBroadcastEmail({
    subject,
    htmlBody,
    recipientName: PREVIEW_RECIPIENT_NAME,
  });

  return {
    html: rendered.html,
    subject: rendered.subject,
    recipientCount: recipients.length,
  };
};

export const notifyResellers = async ({
  subject,
  htmlBody,
  adminUserId,
}: NotifyResellersOptions) => {
  const recipients = await getResellerNotifyRecipients();

  if (recipients.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'No active reseller recipients found',
      userMessage: 'There are no active resellers to notify.',
    });
  }

  const sampleRendered = await renderBroadcastEmail({
    subject,
    htmlBody,
    recipientName: PREVIEW_RECIPIENT_NAME,
  });

  const sender = getSender();

  console.info(
    JSON.stringify({
      event: 'reseller_broadcast_send_started',
      adminUserId,
      recipientCount: recipients.length,
      subject: sampleRendered.subject,
    }),
  );

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const rendered = await renderBroadcastEmail({
        subject,
        htmlBody,
        recipientName: recipient.name,
      });

      await mailer.sendMail({
        to: recipient.email,
        from: sender,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      return recipient.email;
    }),
  );

  const sentCount = results.filter((result) => result.status === 'fulfilled').length;
  const failedCount = results.filter((result) => result.status === 'rejected').length;

  const failedEmails = results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return recipients[index]?.email;
      }

      return null;
    })
    .filter((email): email is string => Boolean(email));

  console.info(
    JSON.stringify({
      event: 'reseller_broadcast_send_completed',
      adminUserId,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      failedEmails,
      subject: sampleRendered.subject,
    }),
  );

  if (sentCount === 0) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to send reseller broadcast emails',
      userMessage: 'Failed to send the notification. Please try again.',
    });
  }

  return {
    recipientCount: recipients.length,
    sentCount,
    failedCount,
  };
};
