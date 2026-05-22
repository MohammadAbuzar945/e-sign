import { prisma } from '@documenso/prisma';
import { paystack } from '@documenso/lib/server-only/paystack';
import { manageSubscription } from '@documenso/lib/server-only/paystack';

// Handle OPTIONS requests for CORS
export async function loader({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  return new Response(null, { status: 405 });
}

export async function action({ request }: { request: Request }) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

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
        { 
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        },
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
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        },
      );
    }

    console.log('Parsing request body...');
    const body = await request.json();
    console.log('Request body:', body);
    
    const subscriptionCode = body.subscriptionCode;
    console.log('Subscription code:', subscriptionCode);

    if (!subscriptionCode) {
      console.log('Missing subscription code');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing subscription code' }),
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          }
        }
      );
    }

    console.log('Looking up subscription in database...');
    // Verify the subscription exists for this organisation and is active
    const subscription = await prisma.subscription.findFirst({
      where: {
        planId: subscriptionCode,
        status: 'ACTIVE',
      },
    });
    console.log('Database query result:', subscription);

    if (!subscription) {
      console.log('Active subscription not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Active subscription not found' }),
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          }
        }
      );
    }

    console.log('Calling Paystack API...');
    // Generate update subscription link from Paystack
    const result = await manageSubscription(subscriptionCode);
    console.log('Paystack API response:', result);

    if (!result.status) {
      console.log('Paystack API error:', result.message);
      return new Response(
        JSON.stringify({ success: false, error: result.message }),
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // Type guard to check if result has data property
    if ('data' in result && result.data && 'link' in result.data) {
      console.log('Successfully generated link:', result.data.link);
      return new Response(
        JSON.stringify({
          success: true,
          link: result.data.link,
        }),
        { 
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          }
        }
      );
    }

    console.log('Invalid Paystack response structure');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid response from Paystack' 
      }),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('Error in API endpoint:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to generate update link' }),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      }
    );
  }
} 