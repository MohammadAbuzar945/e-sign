import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { DocumentAuth } from '../../../types/document-auth';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { extractDocumentAuthMethods } from '../../../utils/document-auth';
import { parseKbaMcqOptions, resolveKbaChallengeForRecipient } from '../../kba/kba';

type GetKbaChallengeByTokenOptions = {
  token: string;
};

export const getKbaChallengeByToken = async ({ token }: GetKbaChallengeByTokenOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.DOCUMENT,
      recipients: {
        some: {
          token,
        },
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
        where: {
          token,
        },
        select: {
          id: true,
          name: true,
          authOptions: true,
          envelopeId: true,
          email: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const [recipient] = envelope.recipients;

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
    recipientAuth: recipient.authOptions,
  });

  if (!derivedRecipientAccessAuth.includes(DocumentAuth.KBA)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'KBA is not required for this document',
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

  if (envelope.kbaPolicy) {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_KBA_CHALLENGE_VIEWED,
        envelopeId: envelope.id,
        user: {
          name: recipient.name || recipient.email,
          email: recipient.email,
        },
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name || recipient.email,
          recipientId: recipient.id,
          answerType: challenge.answerType,
          mode: envelope.kbaPolicy.mode,
        },
      }),
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

