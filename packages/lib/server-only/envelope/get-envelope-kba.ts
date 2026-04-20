import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { isPersistedKbaChallengeCompleteForSend } from '../kba/kba';

type EnvelopeKbaOption = {
  key: string;
  label: string;
};

type EnvelopeKbaChallenge = {
  answerType: 'STRING' | 'NUMERIC' | 'MCQ';
  question: string;
  mcqOptions: EnvelopeKbaOption[];
  isAnswerConfigured: boolean;
};

export type GetEnvelopeKbaResponse = {
  settings: {
    mode: 'PER_ENVELOPE' | 'PER_RECIPIENT';
    isEnabled: boolean;
    maxAttempts: number;
    lockoutMinutes: number;
  } | null;
  envelopeChallenge: EnvelopeKbaChallenge | null;
  recipientChallenges: Array<
    EnvelopeKbaChallenge & {
      recipientId: number;
    }
  >;
};

const parseMcqOptions = (input: unknown): EnvelopeKbaOption[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((option) => {
      if (!option || typeof option !== 'object') {
        return null;
      }

      const maybeKey = 'key' in option ? option.key : null;
      const maybeLabel = 'label' in option ? option.label : null;

      if (typeof maybeKey !== 'string' || typeof maybeLabel !== 'string') {
        return null;
      }

      return {
        key: maybeKey,
        label: maybeLabel,
      };
    })
    .filter((option): option is EnvelopeKbaOption => option !== null);
};

export const getEnvelopeKba = async ({
  userId,
  teamId,
  envelopeId,
}: {
  userId: number;
  teamId: number;
  envelopeId: string;
}): Promise<GetEnvelopeKbaResponse> => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
    select: {
      id: true,
      kbaPolicy: {
        select: {
          mode: true,
          isEnabled: true,
          maxAttempts: true,
          lockoutMinutes: true,
        },
      },
      kbaChallenges: {
        where: {
          isActive: true,
        },
        select: {
          recipientId: true,
          scopeType: true,
          answerType: true,
          question: true,
          answerHash: true,
          mcqOptions: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  const envelopeChallenge = envelope.kbaChallenges.find(
    (challenge) => challenge.scopeType === 'ENVELOPE',
  );

  const recipientChallenges = envelope.kbaChallenges.filter(
    (challenge) => challenge.scopeType === 'RECIPIENT' && challenge.recipientId !== null,
  );

  return {
    settings: envelope.kbaPolicy
      ? {
          mode: envelope.kbaPolicy.mode,
          isEnabled: envelope.kbaPolicy.isEnabled,
          maxAttempts: envelope.kbaPolicy.maxAttempts,
          lockoutMinutes: envelope.kbaPolicy.lockoutMinutes,
        }
      : null,
    envelopeChallenge: envelopeChallenge
      ? {
          answerType: envelopeChallenge.answerType,
          question: envelopeChallenge.question,
          mcqOptions: parseMcqOptions(envelopeChallenge.mcqOptions),
          isAnswerConfigured: isPersistedKbaChallengeCompleteForSend(envelopeChallenge),
        }
      : null,
    recipientChallenges: recipientChallenges.map((challenge) => ({
      recipientId: challenge.recipientId as number,
      answerType: challenge.answerType,
      question: challenge.question,
      mcqOptions: parseMcqOptions(challenge.mcqOptions),
      isAnswerConfigured: isPersistedKbaChallengeCompleteForSend(challenge),
    })),
  };
};

