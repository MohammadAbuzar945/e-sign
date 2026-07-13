import { createHmac, timingSafeEqual } from 'node:crypto';

import { prisma } from '@documenso/prisma';

import { decryptResellerSecret } from '@documenso/lib/server-only/reseller/reseller-secrets';

/** GET requests (e.g. browser or health checks) get 405. */
export async function loader() {
  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

const normaliseEmailFromPaystack = (email: string) => {
  const atIndex = email.indexOf('@');

  if (atIndex === -1) {
    return email;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);
  const plusIndex = localPart.indexOf('+');
  const cleanedLocalPart = plusIndex === -1 ? localPart : localPart.slice(0, plusIndex);

  if (!cleanedLocalPart) {
    return email;
  }

  return `${cleanedLocalPart}@${domainPart}`;
};

const verifyResellerPaystackSignature = ({
  rawBody,
  signature,
  secretKey,
}: {
  rawBody: string;
  signature: string | null;
  secretKey: string;
}) => {
  if (!signature) {
    return false;
  }

  const hash = createHmac('sha512', secretKey).update(rawBody).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
};

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  let event: { event?: string; data?: Record<string, unknown> };

  try {
    event = JSON.parse(rawBody) as { event?: string; data?: Record<string, unknown> };
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Invalid JSON';

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body', detail: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!event?.event || !event.data) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing event or data in payload' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (event.event !== 'charge.success') {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  const { customer, metadata, reference, amount } = event.data as {
    customer?: { email?: string };
    metadata?: {
      type?: string;
      resellerProfileId?: string;
      purchaserOrganisationId?: string;
      purchaserUserId?: number;
      packageId?: string;
      expectedAmount?: number;
      payoutMode?: string;
      subaccountCode?: string;
    };
    reference?: string;
    amount?: number;
  };

  if (metadata?.type !== 'reseller-credit-purchase' || !metadata.resellerProfileId) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { id: metadata.resellerProfileId },
    select: {
      paystackSecretKey: true,
      payoutMode: true,
    },
  });

  if (!profile?.paystackSecretKey || profile.payoutMode !== 'OWN_PAYSTACK') {
    console.error('[RESELLER WEBHOOK]: Missing secret or wrong payout mode', metadata.resellerProfileId);
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }

  const isValid = verifyResellerPaystackSignature({
    rawBody,
    signature,
    secretKey: decryptResellerSecret(profile.paystackSecretKey),
  });

  if (!isValid) {
    console.error('[RESELLER WEBHOOK]: Invalid signature');
    return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), {
      status: 401,
    });
  }

  const { processResellerPaystackWebhook } = await import(
    '@documenso/lib/server-only/reseller/process-reseller-paystack-webhook'
  );

  await processResellerPaystackWebhook({
    paystackReference: reference ?? '',
    metadata,
    amountInCents: Number(amount ?? metadata.expectedAmount ?? 0),
    purchaserEmail: customer?.email ? normaliseEmailFromPaystack(customer.email) : '',
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
