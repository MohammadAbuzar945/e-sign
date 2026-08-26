/**
 * Webhooks created before this instant keep the legacy `X-Documenso-Secret` header.
 * Webhooks created on or after this instant use `X-Nomia-Secret`.
 */
export const WEBHOOK_SECRET_HEADER_CUTOFF = new Date('2026-08-26T00:00:00.000Z');

export const LEGACY_WEBHOOK_SECRET_HEADER = 'X-Documenso-Secret';
export const WEBHOOK_SECRET_HEADER = 'X-Nomia-Secret';

export const getWebhookSecretHeaderName = (createdAt: Date) => {
  if (createdAt < WEBHOOK_SECRET_HEADER_CUTOFF) {
    return LEGACY_WEBHOOK_SECRET_HEADER;
  }

  return WEBHOOK_SECRET_HEADER;
};
