import { Role } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type AdminNotificationRecipient = {
  email: string;
  name: string | null;
};

export const getAdminNotificationRecipients = async (): Promise<AdminNotificationRecipient[]> => {
  const admins = await prisma.user.findMany({
    where: {
      roles: { has: Role.ADMIN },
    },
    select: {
      email: true,
      name: true,
    },
  });

  const byEmail = new Map<string, AdminNotificationRecipient>();

  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase();

    if (!email || byEmail.has(email)) {
      continue;
    }

    byEmail.set(email, {
      email,
      name: admin.name,
    });
  }

  return [...byEmail.values()];
};
