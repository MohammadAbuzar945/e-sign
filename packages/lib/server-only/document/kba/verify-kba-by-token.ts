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

  const failedAttemptsSinceLastSuccess = await prisma.kbaAttempt.count({
    where: {
      challengeId: challenge.id,
      recipientId: recipient.id,
      success: false,
      attemptedAt: latestSuccessAttempt
        ? {
            gt: latestSuccessAttempt.attemptedAt,
          }
        : undefined,
    },
  });

  const mostRecentFailedAttempt = await prisma.kbaAttempt.findFirst({
    where: {
      challengeId: challenge.id,
      recipientId: recipient.id,
      success: false,
      attemptedAt: latestSuccessAttempt
        ? {
            gt: latestSuccessAttempt.attemptedAt,
          }
        : undefined,
    },
    orderBy: {
      attemptedAt: 'desc',
    },
    select: {
      attemptedAt: true,
    },
  });

  const lockoutCutoffDate = new Date(Date.now() - envelope.kbaPolicy.lockoutMinutes * 60 * 1000);
  const isLocked =
    failedAttemptsSinceLastSuccess >= envelope.kbaPolicy.maxAttempts &&
    !!mostRecentFailedAttempt &&
    mostRecentFailedAttempt.attemptedAt > lockoutCutoffDate;

  const { isValid } = await verifyKbaAttempt({
    answer,
    challenge: {
      ...challenge,
      policy: envelope.kbaPolicy,
    },
    failedAttemptsSinceLastSuccess,
    isLocked,
  });

  await prisma.kbaAttempt.create({
    data: {
      challengeId: challenge.id,
      recipientId: recipient.id,
      success: isValid,
    },
  });

  if (!isValid && isLocked) {
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
          attemptsRemaining: Math.max(envelope.kbaPolicy.maxAttempts - (failedAttemptsSinceLastSuccess + 1), 0),
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
    isLocked: !isValid && isLocked,
    attemptsRemaining: isValid
      ? envelope.kbaPolicy.maxAttempts
      : Math.max(envelope.kbaPolicy.maxAttempts - (failedAttemptsSinceLastSuccess + 1), 0),
  };
};

