import { Role } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { ADMIN_HIDDEN_USER_EMAILS } from '../user/service-accounts/deleted-account';

export const getResellerApplicationReviewerEmails = async (): Promise<string[]> => {
  const reviewerUsers = await prisma.user.findMany({
    where: {
      roles: { has: Role.ADMIN },
      email: { notIn: [...ADMIN_HIDDEN_USER_EMAILS] },
    },
    select: { email: true },
  });

  const hiddenEmails = new Set(ADMIN_HIDDEN_USER_EMAILS.map((email) => email.toLowerCase()));

  const emails = new Set<string>(
    reviewerUsers
      .map((user) => user.email.trim().toLowerCase())
      .filter((email) => Boolean(email) && !hiddenEmails.has(email)),
  );

  return [...emails];
};
