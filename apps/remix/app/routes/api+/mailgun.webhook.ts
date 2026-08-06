import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '@documenso/lib/utils/env';
import { handleMailgunPermanentFailure } from '@documenso/lib/server-only/mailgun/handle-mailgun-permanent-failure';

const MAX_TIMESTAMP_SKEW_SECONDS = 15 * 60;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function loader() {
  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}

type MailgunSignature = {
  timestamp: string;
  token: string;
  signature: string;
};

type ParsedMailgunWebhook = {
  signature: MailgunSignature;
  event: string;
  severity?: string;
  reason: string;
  recipientEmail?: string;
  envelopeId?: string;
  recipientId?: number;
  mailgunEvent?: string;
};

const verifyMailgunSignature = ({
  timestamp,
  token,
  signature,
  signingKey,
}: MailgunSignature & { signingKey: string }): boolean => {
  const encoded = createHmac('sha256', signingKey).update(timestamp.concat(token)).digest('hex');

  try {
    const expected = Buffer.from(encoded, 'utf8');
    const actual = Buffer.from(signature, 'utf8');

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

const isTimestampFresh = (timestamp: string): boolean => {
  const ts = Number(timestamp);

  if (!Number.isFinite(ts)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  return Math.abs(nowSeconds - ts) <= MAX_TIMESTAMP_SKEW_SECONDS;
};

const isPermanentFailureEvent = (event: string, severity?: string): boolean => {
  const normalisedEvent = event.toLowerCase();
  const normalisedSeverity = severity?.toLowerCase();

  if (normalisedEvent === 'permanent_fail' || normalisedEvent === 'bounced') {
    return true;
  }

  if (normalisedEvent === 'failed' && normalisedSeverity === 'permanent') {
    return true;
  }

  // Legacy Mailgun "dropped" / bounce notifications.
  if (normalisedEvent === 'dropped' || normalisedEvent === 'bounce') {
    return true;
  }

  return false;
};

const extractUserVariables = (
  source: Record<string, unknown> | undefined,
): { envelopeId?: string; recipientId?: number } => {
  if (!source) {
    return {};
  }

  const userVariables =
    (source['user-variables'] as Record<string, unknown> | undefined) ??
    (source.userVariables as Record<string, unknown> | undefined) ??
    source;

  const envelopeId =
    typeof userVariables.envelopeId === 'string'
      ? userVariables.envelopeId
      : typeof userVariables['envelope-id'] === 'string'
        ? userVariables['envelope-id']
        : undefined;

  const rawRecipientId = userVariables.recipientId ?? userVariables['recipient-id'];
  const recipientId =
    typeof rawRecipientId === 'number'
      ? rawRecipientId
      : typeof rawRecipientId === 'string' && rawRecipientId.trim() !== ''
        ? Number(rawRecipientId)
        : undefined;

  return {
    envelopeId,
    recipientId: Number.isFinite(recipientId) ? recipientId : undefined,
  };
};

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
};

/**
 * Prefer delivery-status details from Mailgun Events API payloads, e.g.:
 * reason: "suppress-bounce"
 * delivery-status.message: ""
 * delivery-status.description: "Not delivering to previously bounced address"
 */
const extractFailureReason = (eventData: Record<string, unknown>): string => {
  const deliveryStatus = eventData['delivery-status'] as Record<string, unknown> | undefined;

  const deliveryMessage = asNonEmptyString(deliveryStatus?.message);
  const deliveryDescription = asNonEmptyString(deliveryStatus?.description);
  const eventReason = asNonEmptyString(eventData.reason);
  const eventDescription = asNonEmptyString(eventData.description);
  const eventError = asNonEmptyString(eventData['error']);

  const detail = deliveryMessage ?? deliveryDescription ?? eventDescription ?? eventError;

  if (eventReason && detail && eventReason.toLowerCase() !== detail.toLowerCase()) {
    return `${eventReason}: ${detail}`;
  }

  return detail ?? eventReason ?? 'Permanent delivery failure';
};

const parseJsonWebhook = (body: Record<string, unknown>): ParsedMailgunWebhook | null => {
  const signatureBlock = body.signature as Record<string, unknown> | undefined;
  const eventData = (body['event-data'] ?? body['event_data'] ?? body) as Record<string, unknown>;

  const timestamp = String(signatureBlock?.timestamp ?? body.timestamp ?? '');
  const token = String(signatureBlock?.token ?? body.token ?? '');
  const signatureValue =
    typeof signatureBlock?.signature === 'string'
      ? signatureBlock.signature
      : typeof body.signature === 'string'
        ? body.signature
        : '';

  if (!timestamp || !token || !signatureValue) {
    return null;
  }

  const event = String(eventData.event ?? body.event ?? '');
  const severity =
    typeof eventData.severity === 'string'
      ? eventData.severity
      : typeof body.severity === 'string'
        ? body.severity
        : undefined;

  const { envelopeId, recipientId } = extractUserVariables(eventData);

  return {
    signature: { timestamp, token, signature: signatureValue },
    event,
    severity,
    reason: extractFailureReason(eventData),
    recipientEmail:
      typeof eventData.recipient === 'string'
        ? eventData.recipient
        : typeof body.recipient === 'string'
          ? body.recipient
          : undefined,
    envelopeId,
    recipientId,
    mailgunEvent: event || undefined,
  };
};

const parseFormWebhook = (form: URLSearchParams): ParsedMailgunWebhook | null => {
  const timestamp = form.get('timestamp') ?? '';
  const token = form.get('token') ?? '';
  const signature = form.get('signature') ?? '';

  if (!timestamp || !token || !signature) {
    return null;
  }

  const event = form.get('event') ?? form.get('event-data[event]') ?? '';
  const severity = form.get('severity') ?? form.get('event-data[severity]') ?? undefined;

  let envelopeId = form.get('envelopeId') ?? form.get('user-variables[envelopeId]') ?? undefined;
  let recipientIdRaw =
    form.get('recipientId') ?? form.get('user-variables[recipientId]') ?? undefined;

  // Some Mailgun form payloads nest user variables as a JSON string.
  const userVariablesRaw = form.get('user-variables') ?? form.get('user_variables');

  if (userVariablesRaw) {
    try {
      const parsed = JSON.parse(userVariablesRaw) as Record<string, unknown>;
      const extracted = extractUserVariables(parsed);

      envelopeId = envelopeId ?? extracted.envelopeId;
      recipientIdRaw =
        recipientIdRaw ??
        (extracted.recipientId !== undefined ? String(extracted.recipientId) : undefined);
    } catch {
      // Ignore malformed user-variables JSON.
    }
  }

  const recipientId =
    recipientIdRaw && recipientIdRaw.trim() !== '' ? Number(recipientIdRaw) : undefined;

  const reason =
    form.get('delivery-status.message') ||
    form.get('reason') ||
    form.get('description') ||
    form.get('error') ||
    'Permanent delivery failure';

  return {
    signature: { timestamp, token, signature },
    event,
    severity: severity || undefined,
    reason,
    recipientEmail: form.get('recipient') ?? undefined,
    envelopeId: envelopeId || undefined,
    recipientId: Number.isFinite(recipientId) ? recipientId : undefined,
    mailgunEvent: event || undefined,
  };
};

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const signingKey = env('NEXT_PRIVATE_MAILGUN_WEBHOOK_SIGNING_KEY');

  if (!signingKey) {
    console.error('Mailgun webhook signing key is not configured');
    return jsonResponse({ success: false, error: 'Webhook not configured' }, 500);
  }

  const contentType = request.headers.get('content-type') ?? '';

  let parsed: ParsedMailgunWebhook | null = null;

  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>;
      parsed = parseJsonWebhook(body);
    } else {
      const form = await request.formData();
      const params = new URLSearchParams();

      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      }

      parsed = parseFormWebhook(params);
    }
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Invalid body';
    console.error('Mailgun webhook parse error:', message);
    return jsonResponse({ success: false, error: 'Invalid body', detail: message }, 400);
  }

  if (!parsed) {
    return jsonResponse({ success: false, error: 'Invalid Mailgun webhook payload' }, 400);
  }

  const isValidSignature = verifyMailgunSignature({
    ...parsed.signature,
    signingKey,
  });

  if (!isValidSignature) {
    return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
  }

  if (!isTimestampFresh(parsed.signature.timestamp)) {
    return jsonResponse({ success: false, error: 'Stale timestamp' }, 401);
  }

  if (!isPermanentFailureEvent(parsed.event, parsed.severity)) {
    return jsonResponse({ success: true, ignored: true, reason: 'Not a permanent failure' });
  }

  if (!parsed.envelopeId || parsed.recipientId === undefined) {
    return jsonResponse({
      success: true,
      ignored: true,
      reason: 'Missing envelopeId or recipientId user-variables',
    });
  }

  const result = await handleMailgunPermanentFailure({
    envelopeId: parsed.envelopeId,
    recipientId: parsed.recipientId,
    reason: parsed.reason,
    mailgunEvent: parsed.mailgunEvent,
    recipientEmail: parsed.recipientEmail,
  });

  if (result.status === 'ignored') {
    return jsonResponse({ success: true, ignored: true, reason: result.reason });
  }

  if (result.status === 'duplicate') {
    return jsonResponse({ success: true, duplicate: true });
  }

  return jsonResponse({ success: true, created: true });
}
