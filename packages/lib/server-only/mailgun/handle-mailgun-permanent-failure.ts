import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export type HandleMailgunPermanentFailureOptions = {
  envelopeId: string;
  recipientId: number;
  reason: string;
  mailgunEvent?: string;
  recipientEmail?: string;
};

export type HandleMailgunPermanentFailureResult =
  | { status: 'created' }
  | { status: 'ignored'; reason: string }
  | { status: 'duplicate' };

export const handleMailgunPermanentFailure = async ({
  envelopeId,
  recipientId,
  reason,
  mailgunEvent,
  recipientEmail,
}: HandleMailgunPermanentFailureOptions): Promise<HandleMailgunPermanentFailureResult> => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
    },
    select: {
      id: true,
      recipients: {
        where: {
          id: recipientId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!envelope) {
    return { status: 'ignored', reason: 'Envelope not found' };
  }

  const recipient = envelope.recipients[0];

  const resolvedEmail = recipient?.email ?? recipientEmail;
  const resolvedName = recipient?.name ?? '';
  const resolvedRole = recipient?.role ?? 'UNKNOWN';

  if (!resolvedEmail) {
    return { status: 'ignored', reason: 'Recipient email not found' };
  }

  const recentDuplicate = await prisma.documentAuditLog.findFirst({
    where: {
      envelopeId,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
      createdAt: {
        gte: new Date(Date.now() - DEDUPE_WINDOW_MS),
      },
      data: {
        path: ['recipientId'],
        equals: recipientId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (recentDuplicate) {
    const existingReason =
      recentDuplicate.data &&
      typeof recentDuplicate.data === 'object' &&
      'reason' in recentDuplicate.data
        ? String((recentDuplicate.data as { reason?: unknown }).reason ?? '')
        : '';

    if (existingReason === reason) {
      return { status: 'duplicate' };
    }
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
      envelopeId,
      user: {
        email: resolvedEmail,
        name: resolvedName,
      },
      data: {
        recipientId,
        recipientEmail: resolvedEmail,
        recipientName: resolvedName,
        recipientRole: resolvedRole,
        reason,
        mailgunEvent,
      },
    }),
  });

  return { status: 'created' };
};
