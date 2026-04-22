import type {
  EnvelopeKbaPolicy,
  KbaAnswerType,
  KbaChallenge,
  KbaScopeType,
  Recipient,
} from '@prisma/client';
import { compare, hash } from '@node-rs/bcrypt';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type {
  TDocumentKbaAnswerType,
  TDocumentKbaChallengeInput,
  TDocumentKbaOption,
} from '../../types/document-auth';

const KBA_HASH_ROUNDS = 10;

type KbaChallengeSummary = Pick<
  KbaChallenge,
  'id' | 'answerType' | 'question' | 'scopeType' | 'recipientId' | 'mcqOptions'
>;

type KbaChallengeWithPolicy = KbaChallengeSummary & {
  answerHash: string;
  policy: Pick<EnvelopeKbaPolicy, 'isEnabled' | 'maxAttempts' | 'lockoutMinutes' | 'mode'>;
};

export const normalizeKbaAnswer = (answerType: TDocumentKbaAnswerType, answer: string) => {
  const trimmedAnswer = answer.trim();

  if (answerType === 'STRING') {
    return trimmedAnswer.replace(/\s+/g, ' ').toLowerCase();
  }

  if (answerType === 'NUMERIC') {
    const numericAnswer = trimmedAnswer.replace(/\s+/g, '');

    if (!/^\d+$/.test(numericAnswer)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'KBA numeric answer must contain digits only',
      });
    }

    return numericAnswer;
  }

  return trimmedAnswer;
};

export const hashKbaChallengeAnswer = async ({
  answerType,
  answer,
}: Pick<TDocumentKbaChallengeInput, 'answerType' | 'answer'>) => {
  const normalizedAnswer = normalizeKbaAnswer(answerType, answer);

  return await hash(normalizedAnswer, KBA_HASH_ROUNDS);
};

export const mapKbaAnswerTypeToPrisma = (answerType: TDocumentKbaAnswerType): KbaAnswerType => {
  return answerType;
};

export const mapKbaScopeTypeToPrisma = (scopeType: 'ENVELOPE' | 'RECIPIENT'): KbaScopeType => {
  return scopeType;
};

export const parseKbaMcqOptions = (mcqOptions: unknown): TDocumentKbaOption[] => {
  if (!mcqOptions || !Array.isArray(mcqOptions)) {
    return [];
  }

  return mcqOptions.filter((item): item is TDocumentKbaOption => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const maybeItem = item as { key?: unknown; label?: unknown };

    return typeof maybeItem.key === 'string' && typeof maybeItem.label === 'string';
  });
};

type PersistedKbaChallengeForSendCheck = Pick<
  KbaChallenge,
  'question' | 'answerHash' | 'answerType' | 'mcqOptions'
>;

/**
 * True when an active KBA row has a non-empty question, a stored answer hash, and (for MCQ) at
 * least two valid options so verification can run.
 */
export const isPersistedKbaChallengeCompleteForSend = (
  challenge: PersistedKbaChallengeForSendCheck | null | undefined,
): boolean => {
  if (!challenge) {
    return false;
  }

  if (!challenge.question.trim()) {
    return false;
  }

  if (!challenge.answerHash.trim()) {
    return false;
  }

  if (challenge.answerType === 'MCQ') {
    return parseKbaMcqOptions(challenge.mcqOptions).length >= 2;
  }

  return true;
};

type ResolveKbaChallengeOptions = {
  recipient: Pick<Recipient, 'id' | 'envelopeId'> & {
    envelope: {
      kbaPolicy: EnvelopeKbaPolicy | null;
      kbaChallenges: KbaChallengeSummary[];
    };
  };
};

export const resolveKbaChallengeForRecipient = ({
  recipient,
}: ResolveKbaChallengeOptions): KbaChallengeSummary | null => {
  const kbaPolicy = recipient.envelope.kbaPolicy;

  if (!kbaPolicy || !kbaPolicy.isEnabled) {
    return null;
  }

  if (kbaPolicy.mode === 'PER_ENVELOPE') {
    return (
      recipient.envelope.kbaChallenges.find(
        (challenge) => challenge.scopeType === 'ENVELOPE' && challenge.recipientId === null,
      ) ?? null
    );
  }

  return (
    recipient.envelope.kbaChallenges.find(
      (challenge) => challenge.scopeType === 'RECIPIENT' && challenge.recipientId === recipient.id,
    ) ?? null
  );
};

type VerifyKbaAttemptOptions = {
  answer: string;
  challenge: KbaChallengeWithPolicy;
  isLocked: boolean;
};

type VerifyKbaAttemptResult = {
  isValid: boolean;
};

export const verifyKbaAttempt = async ({
  answer,
  challenge,
  isLocked,
}: VerifyKbaAttemptOptions): Promise<VerifyKbaAttemptResult> => {
  if (isLocked) {
    return {
      isValid: false,
    };
  }

  const normalizedAnswer = normalizeKbaAnswer(challenge.answerType, answer);
  const isValid = await compare(normalizedAnswer, challenge.answerHash);

  return {
    isValid,
  };
};

