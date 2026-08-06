/**
 * Mailgun SMTP custom variables via `X-Mailgun-Variables`.
 * Returned on webhooks as `user-variables` for correlating delivery events.
 */
export const getMailgunTrackingHeaders = (vars: {
  envelopeId: string;
  recipientId: number;
}) => ({
  'X-Mailgun-Variables': JSON.stringify({
    envelopeId: vars.envelopeId,
    recipientId: String(vars.recipientId),
  }),
});
