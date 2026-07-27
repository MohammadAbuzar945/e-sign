import { Role } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export const getResellerApplicationReviewerEmails = async (): Promise<string[]> => {
  const reviewerUsers = await prisma.user.findMany({
    where: {
      roles: { has: Role.ADMIN },
    },
    select: { email: true },
  });

  const emails = new Set<string>(
    reviewerUsers
      .map((user) => user.email.trim().toLowerCase())
      .filter((email) => Boolean(email)),
  );

  return [...emails];
};
