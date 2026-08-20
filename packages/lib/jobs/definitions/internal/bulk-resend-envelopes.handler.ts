import { createElement } from 'react';

import { msg } from '@lingui/macro';
import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { BulkResendCompleteEmail } from '@documenso/email/templates/bulk-resend-complete';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TBulkResendEnvelopesJobDefinition } from './bulk-resend-envelopes';

const MAX_ATTEMPTS = 3;

const isPrismaTransactionTimeout = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2028';

export const run = async ({
  payload,
  io,
}: {
  payload: TBulkResendEnvelopesJobDefinition;
  io: JobRunIO;
}) => {
  const { userId, teamId, envelopeIds, requestMetadata } = payload;

  const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
    ids: {
      type: 'envelopeId',
      ids: envelopeIds,
    },
    userId,
    teamId,
    type: EnvelopeType.DOCUMENT,
  });

  const envelopes = await prisma.envelope.findMany({
    where: envelopeWhereInput,
    select: {
      id: true,
      status: true,
    },
  });

  const results = {
    resent: 0,
    skipped: 0,
    failed: Array<string>(),
  };

  for (const envelope of envelopes) {
    const { id: envelopeId, status } = envelope;

    // Enforce pending-only regardless of client gating.
    if (status !== DocumentStatus.PENDING) {
      results.skipped += 1;
      continue;
    }

    const outcome = await io.runTask(`resend-${envelopeId}`, async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await resendDocument({
            id: {
              type: 'envelopeId',
              id: envelopeId,
            },
            userId,
            teamId,
            requestMetadata: {
              source: 'app',
              auth: 'session',
              requestMetadata: requestMetadata || {},
            },
          });

          return 'resent' as const;
        } catch (err) {
          const shouldRetry = isPrismaTransactionTimeout(err) && attempt < MAX_ATTEMPTS;

          io.logger.warn(
            {
              envelopeId,
              attempt,
              willRetry: shouldRetry,
              error: err,
            },
            'Failed to resend envelope during bulk redistribute',
          );

          if (!shouldRetry) {
            return 'failed' as const;
          }

          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }

      return 'failed' as const;
    });

    if (outcome === 'resent') {
      results.resent += 1;
    } else {
      results.failed.push(envelopeId);
    }
  }

  const attemptedIds = new Set(envelopes.map((envelope) => envelope.id));
  const unattemptedIds = envelopeIds.filter((id) => !attemptedIds.has(id));

  const failedIds = [...results.failed, ...unattemptedIds];

  io.logger.info(
    {
      teamId,
      userId,
      requested: envelopeIds.length,
      resentCount: results.resent,
      skippedCount: results.skipped,
      failedIds,
    },
    'Bulk redistribute envelopes job complete',
  );

  await io.runTask('send-completion-email', async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
      select: {
        email: true,
        name: true,
      },
    });

    const { branding, emailLanguage, senderEmail } = await getEmailContext({
      emailType: 'INTERNAL',
      source: {
        type: 'team',
        teamId,
      },
    });

    const i18n = await getI18nInstance(emailLanguage);

    const completionTemplate = createElement(BulkResendCompleteEmail, {
      userName: user.name || user.email,
      totalRequested: envelopeIds.length,
      resentCount: results.resent,
      skippedCount: results.skipped,
      failedCount: failedIds.length,
      failedIds,
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(completionTemplate, {
        lang: emailLanguage,
        branding,
      }),
      renderEmailWithI18N(completionTemplate, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: user.name || '',
        address: user.email,
      },
      from: senderEmail,
      subject: i18n._(msg`Bulk resend complete`),
      html,
      text,
    });
  });
};
