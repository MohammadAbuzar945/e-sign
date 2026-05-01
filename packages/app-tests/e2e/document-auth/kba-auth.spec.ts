import { expect, test } from '@playwright/test';

import { updateEnvelopeKba } from '@documenso/lib/server-only/envelope/update-envelope-kba';
import { verifyKbaByToken } from '@documenso/lib/server-only/document/kba/verify-kba-by-token';
import { hashKbaChallengeAnswer } from '@documenso/lib/server-only/kba/kba';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

test('[DOCUMENT_AUTH_KBA]: should validate answers and track attempts', async () => {
  const { user, team } = await seedUser();
  const { user: recipientWithAccount } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [recipientWithAccount.email], {
    createDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['KBA'],
        globalActionAuth: [],
      }),
    },
  });

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      envelopeId: document.id,
      email: recipientWithAccount.email,
    },
  });

  await prisma.envelopeKbaPolicy.create({
    data: {
      envelopeId: document.id,
      mode: 'PER_ENVELOPE',
      isEnabled: true,
      maxAttempts: 5,
      lockoutMinutes: 15,
    },
  });

  await prisma.kbaChallenge.create({
    data: {
      envelopeId: document.id,
      scopeType: 'ENVELOPE',
      answerType: 'STRING',
      question: 'What is your onboarding code?',
      answerHash: await hashKbaChallengeAnswer({
        answerType: 'STRING',
        answer: 'alpha-123',
      }),
      isActive: true,
    },
  });

  const failedAttempt = await verifyKbaByToken({
    token: recipient.token,
    answer: 'wrong-answer',
  });

  expect(failedAttempt.success).toBe(false);
  expect(failedAttempt.isLocked).toBe(false);
  expect(failedAttempt.attemptsRemaining).toBe(4);

  const successfulAttempt = await verifyKbaByToken({
    token: recipient.token,
    answer: 'alpha-123',
  });

  expect(successfulAttempt.success).toBe(true);
  expect(successfulAttempt.isLocked).toBe(false);
  expect(successfulAttempt.attemptsRemaining).toBe(5);
});

test('[DOCUMENT_AUTH_KBA]: should persist envelope settings and recipient challenges', async () => {
  const { user, team } = await seedUser();
  const { user: recipientOne } = await seedUser();
  const { user: recipientTwo } = await seedUser();

  const document = await seedPendingDocument(user, team.id, [recipientOne.email, recipientTwo.email], {
    createDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['KBA'],
        globalActionAuth: [],
      }),
    },
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
    },
    select: {
      id: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  const [firstRecipient, secondRecipient] = recipients;

  await updateEnvelopeKba({
    userId: user.id,
    teamId: team.id,
    envelopeId: document.id,
    settings: {
      mode: 'PER_RECIPIENT',
      isEnabled: true,
      maxAttempts: 4,
      lockoutMinutes: 30,
    },
    recipientChallenges: [
      {
        recipientId: firstRecipient.id,
        answerType: 'NUMERIC',
        question: 'What are the last 4 digits?',
        answer: '1234',
      },
      {
        recipientId: secondRecipient.id,
        answerType: 'MCQ',
        question: 'Choose your verification color',
        answer: 'blue',
        mcqOptions: [
          { key: 'red', label: 'Red' },
          { key: 'blue', label: 'Blue' },
        ],
      },
    ],
  });

  const savedPolicy = await prisma.envelopeKbaPolicy.findUniqueOrThrow({
    where: {
      envelopeId: document.id,
    },
  });

  expect(savedPolicy.isEnabled).toBe(true);
  expect(savedPolicy.mode).toBe('PER_RECIPIENT');
  expect(savedPolicy.maxAttempts).toBe(4);
  expect(savedPolicy.lockoutMinutes).toBe(30);

  const savedChallenges = await prisma.kbaChallenge.findMany({
    where: {
      envelopeId: document.id,
      isActive: true,
    },
    select: {
      recipientId: true,
      answerType: true,
      question: true,
      answerHash: true,
      mcqOptions: true,
    },
  });

  expect(savedChallenges).toHaveLength(2);
  expect(savedChallenges.every((challenge) => challenge.answerHash.length > 0)).toBe(true);
  expect(savedChallenges.some((challenge) => challenge.answerType === 'NUMERIC')).toBe(true);
  expect(savedChallenges.some((challenge) => challenge.answerType === 'MCQ')).toBe(true);
});

