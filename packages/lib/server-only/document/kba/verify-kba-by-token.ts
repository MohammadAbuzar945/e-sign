import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { DocumentAuth } from '../../../types/document-auth';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { extractDocumentAuthMethods } from '../../../utils/document-auth';
import { resolveKbaChallengeForRecipient, verifyKbaAttempt } from '../../kba/kba';

type VerifyKbaByTokenOptions = {
  token: string;
  answer: string;
};

export const verifyKbaByToken = async ({ token, answer }: VerifyKbaByTokenOptions) => {
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
          answerHash: true,
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

  if (!challenge || !envelope.kbaPolicy) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'KBA challenge not found',
    });
  }

  const persistedChallenge = envelope.kbaChallenges.find(
    (envelopeChallenge) => envelopeChallenge.id === challenge.id,
  );

  if (!persistedChallenge) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'KBA challenge not found',
    });
  }

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

  const lockoutDurationMs = envelope.kbaPolicy.lockoutMinutes * 60 * 1000;
  const now = new Date();
  const lockoutCutoffDate = new Date(now.getTime() - lockoutDurationMs);
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

  const isLockedBeforeAttempt =
    failedAttemptsInActiveWindow >= envelope.kbaPolicy.maxAttempts &&
    !!mostRecentFailedAttempt &&
    mostRecentFailedAttempt.attemptedAt > windowStartDate;
  const failedAttemptsBeforeAttempt = failedAttemptsInActiveWindow;

  const { isValid } = await verifyKbaAttempt({
    answer,
    challenge: {
      ...persistedChallenge,
      policy: envelope.kbaPolicy,
    },
    isLocked: isLockedBeforeAttempt,
  });

  const shouldRecordAttempt = !isLockedBeforeAttempt;

  if (shouldRecordAttempt) {
    await prisma.kbaAttempt.create({
      data: {
        challengeId: challenge.id,
        recipientId: recipient.id,
        success: isValid,
      },
    });
  }

  const failedAttemptsAfterAttempt =
    !shouldRecordAttempt || isValid ? failedAttemptsBeforeAttempt : failedAttemptsBeforeAttempt + 1;
  const isLockedAfterAttempt = !isValid && failedAttemptsAfterAttempt >= envelope.kbaPolicy.maxAttempts;

  const lockoutEndTimeMs = shouldRecordAttempt
    ? now.getTime() + lockoutDurationMs
    : mostRecentFailedAttempt
      ? mostRecentFailedAttempt.attemptedAt.getTime() + lockoutDurationMs
      : now.getTime() + lockoutDurationMs;
  const lockoutRemainingSeconds = isLockedAfterAttempt
    ? Math.max(Math.ceil((lockoutEndTimeMs - now.getTime()) / 1000), 0)
    : 0;

  if (!isValid && isLockedAfterAttempt) {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_KBA_LOCKED,
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
  } else if (!isValid) {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_KBA_FAILED,
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
          attemptsRemaining: Math.max(envelope.kbaPolicy.maxAttempts - failedAttemptsAfterAttempt, 0),
        },
      }),
    });
  } else {
    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_KBA_VALIDATED,
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
          attemptsRemaining: envelope.kbaPolicy.maxAttempts,
        },
      }),
    });
  }

  return {
    success: isValid,
    isLocked: isLockedAfterAttempt,
    attemptsRemaining: isValid ? envelope.kbaPolicy.maxAttempts : Math.max(envelope.kbaPolicy.maxAttempts - failedAttemptsAfterAttempt, 0),
    lockoutRemainingSeconds,
  };
};

