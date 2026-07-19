import { PaystackWebhookEventStatus, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { PLAN_DOCUMENT_QUOTAS } from '@documenso/ee/server-only/limits/constants';
import { ensureOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import {
  createPaystackWebhookEvent,
  finalizePaystackWebhookEvent,
} from '@documenso/lib/server-only/paystack/record-paystack-webhook-event';

/** GET requests (e.g. browser or health checks) get 405 so the route is handled instead of framework error. */
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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type WebhookOutcome = {
  status: PaystackWebhookEventStatus;
  result?: Prisma.InputJsonValue;
  error?: string | null;
  response: Response;
};

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      console.warn('Paystack webhook received non-JSON content-type:', contentType);
    }
    event = (await request.json()) as { event?: string; data?: Record<string, unknown> };
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Invalid JSON';
    console.error('Paystack webhook JSON parse error:', message, parseError);
    return jsonResponse({ success: false, error: 'Invalid JSON body', detail: message }, 400);
  }

  if (!event || typeof event !== 'object' || !event.event || !event.data) {
    console.error('Paystack webhook invalid payload shape:', {
      hasEvent: !!event?.event,
      hasData: !!event?.data,
    });
    return jsonResponse({ success: false, error: 'Missing event or data in payload' }, 400);
  }

  const validatedEvent: { event: string; data: Record<string, unknown> } = {
    event: event.event,
    data: event.data,
  };

  const webhookEvent = await createPaystackWebhookEvent(validatedEvent);

  let outcome: WebhookOutcome = {
    status: PaystackWebhookEventStatus.SUCCESS,
    result: { action: 'acknowledged', event: validatedEvent.event },
    response: jsonResponse({ success: true }),
  };

  try {
    console.log('Paystack webhook received event:', JSON.stringify(validatedEvent));

    outcome = await processPaystackWebhookEvent(validatedEvent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Paystack webhook error:', message, stack ?? error);

    outcome = {
      status: PaystackWebhookEventStatus.FAILED,
      error: message,
      result: { action: 'processing_failed' },
      response: jsonResponse(
        {
          success: false,
          error: 'Webhook processing failed',
          detail: message,
        },
        400,
      ),
    };
  } finally {
    await finalizePaystackWebhookEvent({
      id: webhookEvent.id,
      status: outcome.status,
      result: outcome.result,
      error: outcome.error,
    }).catch((finalizeError) => {
      console.error('Failed to finalize Paystack webhook event log:', finalizeError);
    });
  }

  return outcome.response;
}

const processPaystackWebhookEvent = async (event: {
  event: string;
  data: Record<string, unknown>;
}): Promise<WebhookOutcome> => {
  if (event.event === 'subscription.create' || event.event === 'invoice.update') {
    const { customer, plan, subscription_code, next_payment_date, metadata } = event.data as {
      customer?: { email?: string; customer_code?: string };
      plan?: { plan_code?: string };
      subscription_code?: string;
      next_payment_date?: string | null;
      metadata?: { organisationId?: string };
    };

    if (!customer?.email || !plan?.plan_code) {
      console.warn('Paystack webhook: missing customer.email or plan.plan_code', event.data);
      return {
        status: PaystackWebhookEventStatus.IGNORED,
        result: {
          action: 'skipped',
          reason: 'missing_customer_email_or_plan_code',
          event: event.event,
        },
        response: jsonResponse({ success: true }),
      };
    }

    const normalisedEmail = normaliseEmailFromPaystack(customer.email);
    console.log('Extracted from event:', {
      rawEmail: customer.email,
      normalisedEmail,
      plan,
      reference: subscription_code,
      next_payment_date,
    });

    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
      include: {
        userCredits: {
          where: { isActive: true },
          orderBy: { lastUpdatedAt: 'desc' },
          take: 1,
        },
      },
    });

    console.log('User lookup result:', user);

    if (!user || !plan?.plan_code) {
      console.warn('User not found or plan_code missing:', { user, plan });
      return {
        status: PaystackWebhookEventStatus.IGNORED,
        result: {
          action: 'skipped',
          reason: 'user_not_found_or_plan_missing',
          email: normalisedEmail,
          event: event.event,
        },
        response: jsonResponse({ success: true }),
      };
    }

    const organisationIdFromMetadata = metadata?.organisationId;

    const organisation = organisationIdFromMetadata
      ? await prisma.organisation.findUnique({
          where: { id: organisationIdFromMetadata },
        })
      : await prisma.organisation.findFirst({
          where: { ownerUserId: user.id },
        });

    if (!organisation) {
      console.error('Organisation not found for user:', user.id);
      return {
        status: PaystackWebhookEventStatus.FAILED,
        error: 'Organisation not found',
        result: {
          action: 'organisation_not_found',
          userId: user.id,
          event: event.event,
        },
        response: jsonResponse({ success: false, error: 'Organisation not found' }, 400),
      };
    }

    try {
      const PAY_AS_YOU_GO_PLANS = [
        'PLN_f54sm9jv38v7r5m',
        'PLN_5nmok91ploz44u6',
        'PLN_kxqcw02dow71g6c',
        'PLN_ktbomtrjkiz73i1',
        'PLN_59961ig3ply5r3s',
        'PLN_bit1oy0ayiqpkdu',
        'PLN_aiohn8rtai2dtq1',
        'PLN_9n7qj5gj3462buu',
        'PLN_y1fcc9z6et50sx3',
        'PLN_arl2oksyipcd4aq',
        'PLN_jw0og1p6hc4oz9d',
        'PLN_qcz1c2zdiyk3lw3',
      ];

      const pendingSubscription = await prisma.subscription.findFirst({
        where: { customerId: customer.email },
      });

      if (pendingSubscription) {
        console.log('Pending subscription found:', pendingSubscription);

        const subscription = await prisma.subscription.update({
          where: { id: pendingSubscription.id },
          data: {
            planId: subscription_code ?? '',
            priceId: plan.plan_code,
            status: PAY_AS_YOU_GO_PLANS.includes(plan.plan_code) ? 'INACTIVE' : 'ACTIVE',
            periodEnd: PAY_AS_YOU_GO_PLANS.includes(plan.plan_code) ? null : next_payment_date,
          },
        });

        console.log('Subscription updated in .create or .update:', subscription);

        return {
          status: PaystackWebhookEventStatus.SUCCESS,
          result: {
            action: 'subscription_updated',
            event: event.event,
            subscriptionId: subscription.id,
            organisationId: organisation.id,
            planCode: plan.plan_code,
            subscriptionCode: subscription_code ?? null,
          },
          response: jsonResponse({ success: true }),
        };
      }

      console.log('Pending subscription not found in .create or .update:', pendingSubscription);

      return {
        status: PaystackWebhookEventStatus.IGNORED,
        result: {
          action: 'pending_subscription_not_found',
          event: event.event,
          organisationId: organisation.id,
          email: customer.email,
        },
        response: jsonResponse({ success: true }),
      };
    } catch (subError) {
      console.error('Error creating subscription:', subError);
      const message = subError instanceof Error ? subError.message : String(subError);

      return {
        status: PaystackWebhookEventStatus.FAILED,
        error: message,
        result: {
          action: 'subscription_update_failed',
          event: event.event,
          organisationId: organisation.id,
        },
        response: jsonResponse({ success: true }),
      };
    }
  }

  if (event.event === 'subscription.disable') {
    const subscription_code = event.data?.subscription_code as string | undefined;
    console.log('Processing subscription disable:', subscription_code);

    try {
      const existingSubscription = await prisma.subscription.findFirst({
        where: { planId: subscription_code },
      });

      if (existingSubscription) {
        const subscription = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: { status: 'INACTIVE' },
        });
        console.log('Subscription disabled:', subscription);

        return {
          status: PaystackWebhookEventStatus.SUCCESS,
          result: {
            action: 'subscription_disabled',
            subscriptionId: subscription.id,
            subscriptionCode: subscription_code ?? null,
          },
          response: jsonResponse({ success: true }),
        };
      }

      return {
        status: PaystackWebhookEventStatus.IGNORED,
        result: {
          action: 'subscription_not_found',
          subscriptionCode: subscription_code ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    } catch (error) {
      console.error('Error disabling subscription:', error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        status: PaystackWebhookEventStatus.FAILED,
        error: message,
        result: {
          action: 'subscription_disable_failed',
          subscriptionCode: subscription_code ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    }
  }

  if (event.event === 'subscription.not_renew') {
    const subscription_code = event.data?.subscription_code as string | undefined;
    console.log('Processing subscription update:', subscription_code);

    const existingSubscription = await prisma.subscription.findFirst({
      where: { planId: subscription_code },
    });

    if (existingSubscription) {
      const subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: { status: 'INACTIVE' },
      });

      return {
        status: PaystackWebhookEventStatus.SUCCESS,
        result: {
          action: 'subscription_not_renew',
          subscriptionId: subscription.id,
          subscriptionCode: subscription_code ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    }

    return {
      status: PaystackWebhookEventStatus.IGNORED,
      result: {
        action: 'subscription_not_found',
        event: event.event,
        subscriptionCode: subscription_code ?? null,
      },
      response: jsonResponse({ success: true }),
    };
  }

  if (event.event === 'invoice.payment_failed') {
    const subscription_code = event.data?.subscription_code as string | undefined;
    console.log('Processing subscription update:', subscription_code);

    const existingSubscription = await prisma.subscription.findFirst({
      where: { planId: subscription_code },
    });

    if (existingSubscription) {
      const subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: { status: 'INACTIVE', periodEnd: new Date() },
      });

      return {
        status: PaystackWebhookEventStatus.SUCCESS,
        result: {
          action: 'invoice_payment_failed',
          subscriptionId: subscription.id,
          subscriptionCode: subscription_code ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    }

    return {
      status: PaystackWebhookEventStatus.IGNORED,
      result: {
        action: 'subscription_not_found',
        event: event.event,
        subscriptionCode: subscription_code ?? null,
      },
      response: jsonResponse({ success: true }),
    };
  }

  if (event.event === 'charge.success') {
    const { customer, metadata, plan, reference, amount } = event.data as {
      customer?: { email?: string };
      metadata?: {
        value?: number;
        organisationId?: string;
        type?: string;
        resellerProfileId?: string;
        purchaserOrganisationId?: string;
        purchaserUserId?: number;
        packageId?: string;
        expectedAmount?: number;
        purchaseGroupId?: string;
      };
      plan?: { plan_code?: string };
      reference?: string;
      amount?: number;
    };

    if (metadata?.type === 'reseller-credit-purchase') {
      const { processResellerPaystackWebhook } = await import(
        '@documenso/lib/server-only/reseller/process-reseller-paystack-webhook'
      );

      await processResellerPaystackWebhook({
        paystackReference: reference ?? '',
        metadata,
        amountInCents: Number(amount ?? metadata.expectedAmount ?? 0),
        purchaserEmail: customer?.email ? normaliseEmailFromPaystack(customer.email) : '',
      });

      return {
        status: PaystackWebhookEventStatus.SUCCESS,
        result: {
          action: 'reseller_credit_purchase_processed',
          reference: reference ?? null,
          resellerProfileId: metadata.resellerProfileId ?? null,
          organisationId: metadata.purchaserOrganisationId ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    }

    const customerEmailRaw = customer?.email;

    if (!customerEmailRaw) {
      console.warn('Paystack webhook charge.success: missing customer.email', event.data);
      return {
        status: PaystackWebhookEventStatus.IGNORED,
        result: {
          action: 'skipped',
          reason: 'missing_customer_email',
          event: event.event,
        },
        response: jsonResponse({ success: true }),
      };
    }

    const customerEmail = normaliseEmailFromPaystack(customerEmailRaw);

    const refferCredits = metadata?.value as number | undefined;
    const organisationIdFromMetadata = metadata?.organisationId as string | undefined;

    const planCode = plan?.plan_code;

    console.log('Plan code:', planCode);

    if (!planCode) {
      const user = await prisma.user.findUnique({
        where: { email: customerEmail },
      });

      if (!user) {
        console.error('Paystack webhook charge.success: user not found for email', customerEmail);
        return {
          status: PaystackWebhookEventStatus.IGNORED,
          result: {
            action: 'skipped',
            reason: 'user_not_found',
            email: customerEmail,
          },
          response: jsonResponse({ success: true }),
        };
      }

      const organisation = organisationIdFromMetadata
        ? await prisma.organisation.findUnique({
            where: { id: organisationIdFromMetadata },
          })
        : await prisma.organisation.findFirst({
            where: { ownerUserId: user.id },
          });

      if (!organisation) {
        console.error('Organisation not found for user:', user.id);
        return {
          status: PaystackWebhookEventStatus.FAILED,
          error: 'Organisation not found',
          result: {
            action: 'organisation_not_found',
            userId: user.id,
          },
          response: jsonResponse({ success: false, error: 'Organisation not found' }, 400),
        };
      }

      const creditsToAdd = Number(refferCredits);
      const grossAmount = Number(amount ?? 0);
      const userCreditsRecord = await ensureOrganisationCredits(organisation.id, user.id);

      if (userCreditsRecord && !Number.isNaN(creditsToAdd) && creditsToAdd > 0) {
        await prisma.userCredits.update({
          where: { id: userCreditsRecord.id },
          data: { credits: Number(userCreditsRecord.credits) + creditsToAdd },
        });
      }

      let purchaseId: string | null = null;
      let isNewlyCompleted = false;

      if (reference && !Number.isNaN(creditsToAdd) && creditsToAdd > 0 && grossAmount > 0) {
        const {
          completeOrganisationCreditPurchase,
          resolveNomiaPurchaseInvoiceId,
        } = await import('@documenso/lib/server-only/billing/record-organisation-credit-purchase');

        const { purchase, isNewlyCompleted: newlyCompleted } =
          await completeOrganisationCreditPurchase({
            paystackReference: reference,
            organisationId: organisation.id,
            userId: user.id,
            credits: creditsToAdd,
            grossAmount,
            purchaseGroupId:
              typeof metadata?.purchaseGroupId === 'string' ? metadata.purchaseGroupId : undefined,
          });

        purchaseId = purchase.id;
        isNewlyCompleted = newlyCompleted;

        if (newlyCompleted) {
          const { sendPurchaseInvoiceEmail } = await import(
            '@documenso/lib/server-only/billing/send-purchase-invoice-email'
          );

          await sendPurchaseInvoiceEmail({
            organisationId: organisation.id,
            invoiceId: resolveNomiaPurchaseInvoiceId({
              purchaseId: purchase.id,
              purchaseGroupId: purchase.purchaseGroupId,
            }),
            recipientEmail: user.email,
            recipientName: user.name,
          }).catch((invoiceError) => {
            console.error('[NOMIA]: Failed to send purchase invoice email', invoiceError);
          });
        }
      }

      console.log('Pay as you go credits added successfully');

      return {
        status: PaystackWebhookEventStatus.SUCCESS,
        result: {
          action: 'payg_credits_added',
          organisationId: organisation.id,
          userId: user.id,
          creditsAdded: !Number.isNaN(creditsToAdd) && creditsToAdd > 0 ? creditsToAdd : 0,
          reference: reference ?? null,
          purchaseId,
          isNewlyCompleted,
        },
        response: jsonResponse({ success: true, message: 'Credits added successfully' }),
      };
    }

    const pendingSubscription = await prisma.subscription.findFirst({
      where: {
        customerId: {
          equals: customerEmailRaw,
          mode: 'insensitive',
        },
      },
    });

    if (pendingSubscription) {
      const organisationId = pendingSubscription.organisationId;
      console.log('Pending subscription found:', pendingSubscription);

      const user = await prisma.user.findUnique({
        where: { email: normaliseEmailFromPaystack(customerEmailRaw) },
      });

      if (!user) {
        console.error('Paystack webhook charge.success: user not found for email', customerEmail);
        return {
          status: PaystackWebhookEventStatus.IGNORED,
          result: {
            action: 'skipped',
            reason: 'user_not_found',
            email: customerEmail,
          },
          response: jsonResponse({ success: true }),
        };
      }

      const subscription = await prisma.subscription.update({
        where: { id: pendingSubscription.id },
        data: { status: 'ACTIVE', periodEnd: null },
      });
      console.log('Subscription updated:', subscription);

      const userCreditsRecord = await ensureOrganisationCredits(organisationId, user.id);

      console.log('User credits record:', userCreditsRecord);
      const newPlanCredits = PLAN_DOCUMENT_QUOTAS[planCode] ?? 0;
      console.log('New plan credits:', newPlanCredits);

      let creditsAfter: number | null = null;

      if (newPlanCredits > 0) {
        const userCredits = await prisma.userCredits.update({
          where: { id: userCreditsRecord.id },
          data: { credits: Number(userCreditsRecord.credits) + newPlanCredits },
        });
        console.log('User credits updated:', userCredits);
        creditsAfter = Number(userCredits.credits);
      }

      console.log('subscription and credits updated successfully');

      return {
        status: PaystackWebhookEventStatus.SUCCESS,
        result: {
          action: 'subscription_activated_and_credits_added',
          subscriptionId: subscription.id,
          organisationId,
          userId: user.id,
          planCode,
          creditsAdded: newPlanCredits,
          creditsAfter,
          reference: reference ?? null,
        },
        response: jsonResponse({ success: true }),
      };
    }

    return {
      status: PaystackWebhookEventStatus.IGNORED,
      result: {
        action: 'pending_subscription_not_found',
        planCode,
        email: customerEmail,
        reference: reference ?? null,
      },
      response: jsonResponse({ success: true }),
    };
  }

  return {
    status: PaystackWebhookEventStatus.IGNORED,
    result: {
      action: 'unhandled_event',
      event: event.event,
    },
    response: jsonResponse({ success: true }),
  };
};
