import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Organisation } from '@prisma/client';
import { OrganisationMemberInviteStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { OrganisationInviteReminderEmailTemplate } from '@documenso/email/templates/organisation-invite-reminder';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';

export type PendingOrganisationInvite = {
  id: string;
  email: string;
  organisationRole: string;
  createdAt: Date;
};

export const getPendingOrganisationInvites = async (
  organisationId: string,
): Promise<PendingOrganisationInvite[]> => {
  const invites = await prisma.organisationMemberInvite.findMany({
    where: {
      organisationId,
      status: OrganisationMemberInviteStatus.PENDING,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    organisationRole: invite.organisationRole,
    createdAt: invite.createdAt,
  }));
};

export type SendOrganisationInviteRemindersOptions = {
  organisationId: string;

  /**
   * When provided, only these invites are reminded. Otherwise every pending
   * invite for the organisation is reminded.
   */
  invitationIds?: string[];
};

export type SendOrganisationInviteRemindersResult = {
  sentCount: number;
  failedCount: number;
};

/**
 * Send an anonymous, system-generated reminder for pending organisation invites.
 *
 * No admin identity is included in the email so recipients cannot tell that a
 * person triggered it.
 */
export const sendOrganisationInviteReminders = async ({
  organisationId,
  invitationIds,
}: SendOrganisationInviteRemindersOptions): Promise<SendOrganisationInviteRemindersResult> => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const invites = await prisma.organisationMemberInvite.findMany({
    where: {
      organisationId,
      status: OrganisationMemberInviteStatus.PENDING,
      ...(invitationIds && invitationIds.length > 0 ? { id: { in: invitationIds } } : {}),
    },
  });

  if (invites.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
    };
  }

  const results = await Promise.allSettled(
    invites.map(async (invite) =>
      sendOrganisationInviteReminderEmail({
        email: invite.email,
        token: invite.token,
        organisation,
      }),
    ),
  );

  const failedCount = results.filter((result) => result.status === 'rejected').length;

  return {
    sentCount: results.length - failedCount,
    failedCount,
  };
};

type SendOrganisationInviteReminderEmailOptions = {
  email: string;
  token: string;
  organisation: Pick<Organisation, 'id' | 'name'>;
};

const sendOrganisationInviteReminderEmail = async ({
  email,
  token,
  organisation,
}: SendOrganisationInviteReminderEmailOptions) => {
  const template = createElement(OrganisationInviteReminderEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    organisationName: organisation.name,
    token,
  });

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, {
      lang: emailLanguage,
      branding,
    }),
    renderEmailWithI18N(template, {
      lang: emailLanguage,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

  await mailer.sendMail({
    to: email,
    from: senderEmail,
    subject: i18n._(msg`Reminder: your invitation to join ${organisation.name} on Nomia`),
    html,
    text,
  });
};
