import { disableSubscription } from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

export async function action({ request }: { request: Request }) {
  try {
    const session = await prisma.session.findFirst({
      where: {
        sessionToken: request
          .headers
          .get('cookie')
          ?.split('next-auth.session-token=')[1]
          ?.split(';')[0],
      },
      include: {
        user: true,
      },
    });

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401 },
      );
    }

    const organisation = await prisma.organisation.findFirst({
      where: {
        ownerUserId: session.user.id,
      },
    });

    if (!organisation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organisation not found' }),
        { status: 404 },
      );
    }

    const { subscriptionCode } = await request.json();

    if (!subscriptionCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing subscription code' }),
        { status: 400 }
      );
    }

    // Verify the subscription exists and is active
    const subscription = await prisma.subscription.findFirst({
      where: {
        planId: subscriptionCode,
        status: 'ACTIVE',
      },
    });

    if (!subscription) {
      return new Response(
        JSON.stringify({ success: false, error: 'Active subscription not found' }),
        { status: 404 }
      );
    }

    // Call Paystack API to disable the subscription
    const result = await disableSubscription(subscriptionCode);

    if (!result.status) {
      return new Response(
        JSON.stringify({ success: false, error: result.message }),
        { status: 500 }
      );
    }

    // Update subscription status in our database
    await prisma.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: 'INACTIVE',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription disabled successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error disabling subscription:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to disable subscription' }),
      { status: 500 }
    );
  }
} 