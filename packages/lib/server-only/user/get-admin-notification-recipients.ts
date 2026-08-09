import { Role } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { ADMIN_HIDDEN_USER_EMAILS } from './service-accounts/deleted-account';

export type AdminNotificationRecipient = {
  email: string;
  name: string | null;
};

const HIDDEN_ADMIN_NOTIFICATION_EMAILS = new Set(
  ADMIN_HIDDEN_USER_EMAILS.map((email) => email.toLowerCase()),
);

export const getAdminNotificationRecipients = async (): Promise<AdminNotificationRecipient[]> => {
  const admins = await prisma.user.findMany({
    where: {
      roles: { has: Role.ADMIN },
      email: { notIn: [...ADMIN_HIDDEN_USER_EMAILS] },
    },
    select: {
      email: true,
      name: true,
    },
  });

  const byEmail = new Map<string, AdminNotificationRecipient>();

  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase();

    if (!email || byEmail.has(email) || HIDDEN_ADMIN_NOTIFICATION_EMAILS.has(email)) {
      continue;
    }

    byEmail.set(email, {
      email,
      name: admin.name,
    });
  }

  return [...byEmail.values()];
};
