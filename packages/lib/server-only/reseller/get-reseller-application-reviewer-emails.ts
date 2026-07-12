import { Role } from '@prisma/client';

import { RESELLER_FEATURE_ALLOWED_EMAILS } from '@documenso/lib/constants/esign-credit-packages';
import { prisma } from '@documenso/prisma';

export const getResellerApplicationReviewerEmails = async (): Promise<string[]> => {
  const reviewerUsers = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { has: Role.ADMIN } },
        { email: { in: [...RESELLER_FEATURE_ALLOWED_EMAILS] } },
      ],
    },
    select: { email: true },
  });

  const emails = new Set<string>([
    ...reviewerUsers.map((user) => user.email.toLowerCase()),
    ...RESELLER_FEATURE_ALLOWED_EMAILS,
  ]);

  return [...emails];
};
