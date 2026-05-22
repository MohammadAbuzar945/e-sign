import { prisma } from '@documenso/prisma';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';

export async function loader({ request }: { request: Request }) {
  try {
    // Get the session from the request
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
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: {
        ownerUserId: session.user.id,
      },
    });

    if (!organisation) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
      });
    }

    const subscriptions = await getSubscriptionsByUserId({
      organisationId: organisation.id,
    });

    return new Response(JSON.stringify({ success: true, data: subscriptions }), {
      status: 200,
    });
  } catch (error) {
    console.error('[GET_SUBSCRIPTIONS]', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch subscriptions' }), {
      status: 500,
    });
  }
}