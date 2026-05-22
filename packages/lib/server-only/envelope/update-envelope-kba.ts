import { KbaMode, KbaScopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { TDocumentKbaChallengeInput, TDocumentKbaSettings } from '../../types/document-auth';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { buildTeamWhereQuery } from '../../utils/teams';
import { hashKbaChallengeAnswer } from '../kba/kba';

type RecipientKbaChallengeInput = TDocumentKbaChallengeInput & {
  recipientId: number;
};

export type UpdateEnvelopeKbaOptions = {
  userId: number;
  teamId: number;
  envelopeId: string;
  settings: TDocumentKbaSettings;
  envelopeChallenge?: TDocumentKbaChallengeInput | null;
  recipientChallenges?: RecipientKbaChallengeInput[];
  actor?: {
    id: number;
    name?: string | null;
    email?: string | null;
  };
  requestMetadata?: {
    userAgent?: string;
    ipAddress?: string;
  };
};

export const updateEnvelopeKba = async ({
  userId,
  teamId,
  envelopeId,
  settings,
  envelopeChallenge,
  recipientChallenges = [],
  actor,
  requestMetadata,
}: UpdateEnvelopeKbaOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
    select: {
      id: true,
      recipients: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (settings.isEnabled && settings.mode === 'PER_ENVELOPE' && !envelopeChallenge) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Envelope KBA challenge is required for PER_ENVELOPE mode',
    });
  }

  if (settings.isEnabled && settings.mode === 'PER_RECIPIENT' && recipientChallenges.length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Recipient KBA challenges are required for PER_RECIPIENT mode',
    });
  }

  const envelopeRecipientIds = new Set(envelope.recipients.map((recipient) => recipient.id));

  for (const challenge of recipientChallenges) {
    if (!envelopeRecipientIds.has(challenge.recipientId)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient ${challenge.recipientId} is not part of this envelope`,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.envelopeKbaPolicy.upsert({
      where: {
        envelopeId: envelope.id,
      },
      update: {
        mode: settings.mode as KbaMode,
        isEnabled: settings.isEnabled,
        maxAttempts: settings.maxAttempts,
        lockoutMinutes: settings.lockoutMinutes,
      },
      create: {
        envelopeId: envelope.id,
        mode: settings.mode as KbaMode,
        isEnabled: settings.isEnabled,
        maxAttempts: settings.maxAttempts,
        lockoutMinutes: settings.lockoutMinutes,
      },
    });

    if (!settings.isEnabled) {
      await tx.kbaChallenge.updateMany({
        where: {
          envelopeId: envelope.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return;
    }

    if (settings.mode === 'PER_ENVELOPE' && envelopeChallenge) {
      await tx.kbaChallenge.updateMany({
        where: {
          envelopeId: envelope.id,
          scopeType: KbaScopeType.ENVELOPE,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      await tx.kbaChallenge.create({
        data: {
          envelopeId: envelope.id,
          scopeType: KbaScopeType.ENVELOPE,
          answerType: envelopeChallenge.answerType,
          question: envelopeChallenge.question,
          answerHash: await hashKbaChallengeAnswer(envelopeChallenge),
          mcqOptions: envelopeChallenge.mcqOptions ?? undefined,
          isActive: true,
        },
      });
    }

    if (settings.mode === 'PER_RECIPIENT') {
      await tx.kbaChallenge.updateMany({
        where: {
          envelopeId: envelope.id,
          scopeType: KbaScopeType.RECIPIENT,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      for (const recipientChallenge of recipientChallenges) {
        await tx.kbaChallenge.create({
          data: {
            envelopeId: envelope.id,
            recipientId: recipientChallenge.recipientId,
            scopeType: KbaScopeType.RECIPIENT,
            answerType: recipientChallenge.answerType,
            question: recipientChallenge.question,
            answerHash: await hashKbaChallengeAnswer(recipientChallenge),
            mcqOptions: recipientChallenge.mcqOptions ?? undefined,
            isActive: true,
          },
        });
      }
    }

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_KBA_CONFIG_UPDATED,
        envelopeId: envelope.id,
        user: actor,
        requestMetadata,
        data: {
          mode: settings.mode,
          isEnabled: settings.isEnabled,
          maxAttempts: settings.maxAttempts,
          lockoutMinutes: settings.lockoutMinutes,
          envelopeChallengeAnswerType: settings.mode === 'PER_ENVELOPE' ? envelopeChallenge?.answerType ?? null : null,
          recipientChallengeAnswerTypes:
            settings.mode === 'PER_RECIPIENT'
              ? recipientChallenges.map((challenge) => ({
                  recipientId: challenge.recipientId,
                  answerType: challenge.answerType,
                }))
              : [],
        },
      }),
    });
  });

  return {
    success: true as const,
  };
};

