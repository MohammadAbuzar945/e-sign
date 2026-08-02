import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import ResellerApplicationSubmittedAdminEmailTemplate from '@documenso/email/templates/reseller-application-submitted-admin';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getResellerApplicationReviewerEmails } from './get-reseller-application-reviewer-emails';

export type SendResellerApplicationAdminNotificationOptions = {
  applicationId: string;
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
  completedDocumentCount: number;
  uniqueSignerCount: number;
  organisationUserCount: number;
  organisationSignupDate: Date;
};

export const sendResellerApplicationAdminNotification = async ({
  applicationId,
  organisationName,
  applicantName,
  applicantEmail,
  completedDocumentCount,
  uniqueSignerCount,
  organisationUserCount,
  organisationSignupDate,
}: SendResellerApplicationAdminNotificationOptions) => {
  const reviewerEmails = await getResellerApplicationReviewerEmails();

  if (reviewerEmails.length === 0) {
    return;
  }

  const adminReviewUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/admin/reseller-applications`;
  const formattedSignupDate = organisationSignupDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const emailContent = createElement(ResellerApplicationSubmittedAdminEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    organisationName,
    applicantName,
    applicantEmail,
    completedDocumentCount,
    uniqueSignerCount,
    organisationUserCount,
    organisationSignupDate: formattedSignupDate,
    applicationId,
    adminReviewUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailContent, { lang: 'en' }),
    renderEmailWithI18N(emailContent, { lang: 'en', plainText: true }),
  ]);

  const i18n = await getI18nInstance('en');

  await mailer.sendMail({
    to: reviewerEmails,
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: i18n._(msg`New reseller application from ${organisationName}`),
    html,
    text,
  });
};
