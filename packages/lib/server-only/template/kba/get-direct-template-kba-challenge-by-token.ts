import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { DocumentAuth } from '../../../types/document-auth';
import { extractDocumentAuthMethods } from '../../../utils/document-auth';
import { parseKbaMcqOptions, resolveKbaChallengeForRecipient } from '../../kba/kba';

type GetDirectTemplateKbaChallengeByTokenOptions = {
  token: string;
};

export const getDirectTemplateKbaChallengeByToken = async ({
  token,
}: GetDirectTemplateKbaChallengeByTokenOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.TEMPLATE,
      directLink: {
        enabled: true,
        token,
      },
    },
    include: {
      kbaPolicy: true,
      kbaChallenges: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          answerType: true,
          question: true,
          scopeType: true,
          recipientId: true,
          mcqOptions: true,
        },
      },
      recipients: {
        select: {
          id: true,
          envelopeId: true,
          authOptions: true,
        },
      },
      directLink: {
        select: {
          directTemplateRecipientId: true,
        },
      },
    },
  });

  if (!envelope || !envelope.directLink) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const recipient = envelope.recipients.find(
    (possibleRecipient) => possibleRecipient.id === envelope.directLink?.directTemplateRecipientId,
  );

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template recipient not found',
    });
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  if (!derivedRecipientAccessAuth.includes(DocumentAuth.KBA)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'KBA is not required for this direct template',
    });
  }

  const challenge = resolveKbaChallengeForRecipient({
    recipient: {
      ...recipient,
      envelope: {
        kbaPolicy: envelope.kbaPolicy,
        kbaChallenges: envelope.kbaChallenges,
      },
    },
  });

  if (!challenge) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'KBA challenge not found',
    });
  }

  let isLocked = false;
  let lockoutRemainingSeconds = 0;

  if (envelope.kbaPolicy) {
    const latestSuccessAttempt = await prisma.kbaAttempt.findFirst({
      where: {
        challengeId: challenge.id,
        recipientId: recipient.id,
        success: true,
      },
      orderBy: {
        attemptedAt: 'desc',
      },
      select: {
        attemptedAt: true,
      },
    });

    const nowMs = Date.now();
    const lockoutDurationMs = envelope.kbaPolicy.lockoutMinutes * 60 * 1000;
    const lockoutCutoffDate = new Date(nowMs - lockoutDurationMs);
    const windowStartDate =
      latestSuccessAttempt && latestSuccessAttempt.attemptedAt > lockoutCutoffDate
        ? latestSuccessAttempt.attemptedAt
        : lockoutCutoffDate;

    const failedAttemptsInActiveWindow = await prisma.kbaAttempt.count({
      where: {
        challengeId: challenge.id,
        recipientId: recipient.id,
        success: false,
        attemptedAt: {
          gt: windowStartDate,
        },
      },
    });

    const mostRecentFailedAttempt = await prisma.kbaAttempt.findFirst({
      where: {
        challengeId: challenge.id,
        recipientId: recipient.id,
        success: false,
        attemptedAt: {
          gt: windowStartDate,
        },
      },
      orderBy: {
        attemptedAt: 'desc',
      },
      select: {
        attemptedAt: true,
      },
    });

    isLocked =
      failedAttemptsInActiveWindow >= envelope.kbaPolicy.maxAttempts &&
      !!mostRecentFailedAttempt &&
      mostRecentFailedAttempt.attemptedAt > windowStartDate;

    if (isLocked && mostRecentFailedAttempt) {
      lockoutRemainingSeconds = Math.max(
        Math.ceil((mostRecentFailedAttempt.attemptedAt.getTime() + lockoutDurationMs - nowMs) / 1000),
        0,
      );
    }
  }

  return {
    challengeId: challenge.id,
    answerType: challenge.answerType,
    question: challenge.question,
    mcqOptions: parseKbaMcqOptions(challenge.mcqOptions),
    maxAttempts: envelope.kbaPolicy?.maxAttempts ?? 5,
    lockoutMinutes: envelope.kbaPolicy?.lockoutMinutes ?? 15,
    isLocked,
    lockoutRemainingSeconds,
  };
};
