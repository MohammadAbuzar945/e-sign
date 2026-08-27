import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * Email gate for the admin "remind pending invites" tooling.
 *
 * Only admins whose email contains one of these substrings may see or use the
 * feature. The admin role is still required on top of this gate.
 */
export const INVITE_REMINDER_ALLOWED_EMAIL_SUBSTRINGS = ['abuzar'] as const;

export const INVITE_REMINDER_ACCESS_DENIED_MESSAGE =
  'Invite reminders are not available for your account.';

export const hasInviteReminderFeatureAccess = (email: string | null | undefined) => {
  const normalised = email?.trim().toLowerCase();

  if (!normalised) {
    return false;
  }

  return INVITE_REMINDER_ALLOWED_EMAIL_SUBSTRINGS.some((substring) =>
    normalised.includes(substring),
  );
};

export const assertInviteReminderFeatureAccess = (email: string | null | undefined) => {
  if (!hasInviteReminderFeatureAccess(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: INVITE_REMINDER_ACCESS_DENIED_MESSAGE,
    });
  }
};
