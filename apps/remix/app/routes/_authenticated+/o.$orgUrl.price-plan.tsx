import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@documenso/ui/primitives/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans } from '@lingui/react/macro';
import { ChevronLeftIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRevalidator } from 'react-router';
import { appMetaTags } from '~/utils/meta';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/o.$orgUrl.price-plan';
import { msg } from '@lingui/core/macro';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await getSession(request);
  const { orgUrl } = params;

  const organisation = await prisma.organisation.findFirst({
    where: {
      url: orgUrl,
      members: {
        some: {
          userId: user.id,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  // Check if user is the owner
  if (organisation.ownerUserId !== user.id) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Only organisation owners can access pricing plans',
    });
  }

  const subscriptions = await getSubscriptionsByUserId({ organisationId: organisation.id });

  return superLoaderJson({ subscriptions, user, organisation });
};

const payAsYouGoRedirects = {
  '20': 'https://paystack.shop/pay/testqoiw2m',
  '50': 'https://paystack.shop/pay/guc0g9s57q',
  '100': 'https://paystack.shop/pay/dfpu1arzjn',
  '200': 'https://paystack.shop/pay/c4jdb6jsv7',
  '500': 'https://paystack.shop/pay/bpbblrunck',
  '1000': 'https://paystack.shop/pay/q2shmym9rjg',
};

const TEST_PLANS_DATA = {
  'Pay-as-you-go / Top-up': [
    {
      name: '20 envelopes',
      credits: 20,
      amount: 'ZAR 190',
      planCode: 'PLN_bit1oy0ayiqpkdu',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[20],
    },
    {
      name: '50 envelopes',
      credits: 50,
      amount: 'ZAR 450',
      planCode: 'PLN_59961ig3ply5r3s',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[50],
    },
    {
      name: '100 envelopes',
      credits: 100,
      amount: 'ZAR 850',
      planCode: 'PLN_ktbomtrjkiz73i1',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[100],
    },
    {
      name: '200 envelopes',
      credits: 200,
      amount: 'ZAR 1,600',
      planCode: 'PLN_kxqcw02dow71g6c',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[200],
    },
    {
      name: '500 envelopes',
      credits: 500,
      amount: 'ZAR 3,750',
      planCode: 'PLN_5nmok91ploz44u6',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[500],
    },
    {
      name: '1000 envelopes',
      credits: 1000,
      amount: 'ZAR 7,000',
      planCode: 'PLN_f54sm9jv38v7r5m',
      label: 'Pay as you go',
      redirect_url: payAsYouGoRedirects[1000],
    },
  ],
  Monthly: [
    {
      name: '20 envelopes',
      credits: 20,
      amount: 'ZAR 170',
      planCode: 'PLN_1croxh14pyq4cj7',
      label: 'Monthly',
    },
    {
      name: '50 envelopes',
      credits: 50,
      amount: 'ZAR 400',
      planCode: 'PLN_zel9llutx085dp9',
      label: 'Monthly',
    },
    {
      name: '100 envelopes',
      credits: 100,
      amount: 'ZAR 750',
      planCode: 'PLN_yvo5ujkxt1diiak',
      label: 'Monthly',
    },
    {
      name: '200 envelopes',
      credits: 200,
      amount: 'ZAR 1,400',
      planCode: 'PLN_0oqk4fljy5uais0',
      label: 'Monthly',
    },
    {
      name: '500 envelopes',
      credits: 500,
      amount: 'ZAR 3,250',
      planCode: 'PLN_27yc6cxtga9huy7',
      label: 'Monthly',
    },
    {
      name: '1000 envelopes',
      credits: 1000,
      amount: 'ZAR 6,000',
      planCode: 'PLN_q4qbiwreibc8qr5',
      label: 'Monthly',
    },
  ],
  Annual: [
    {
      name: '240 envelopes',
      credits: 240,
      amount: 'ZAR 1,700',
      planCode: 'PLN_coac3n7m4jo59ct',
      label: 'Annually',
    },
    {
      name: '600 envelopes',
      credits: 600,
      amount: 'ZAR 4,000',
      planCode: 'PLN_8kh731h1ojcx37d',
      label: 'Annually',
    },
    {
      name: '1200 envelopes',
      credits: 1200,
      amount: 'ZAR 7,500',
      planCode: 'PLN_tzngz1lbhvxnufb',
      label: 'Annually',
    },
    {
      name: '2400 envelopes',
      credits: 2400,
      amount: 'ZAR 14,000',
      planCode: 'PLN_kn6j6ur12pedilo',
      label: 'Annually',
    },
    {
      name: '6000 envelopes',
      credits: 6000,
      amount: 'ZAR 33,000',
      planCode: 'PLN_moko1x694rvm5l8',
      label: 'Annually',
    },
    {
      name: '12000 envelopes',
      credits: 12000,
      amount: 'ZAR 60,000',
      planCode: 'PLN_scnf05tt3vrui2i',
      label: 'Annually',
    },
  ],
} as const;

const LIVE_PLANS_DATA = {
  'Pay-as-you-go / Top-up': TEST_PLANS_DATA['Pay-as-you-go / Top-up'],
  Monthly: [
    {
      name: '20 envelopes',
      credits: 20,
      amount: 'ZAR 170',
      planCode: 'PLN_4yptquhayqxdx68',
      label: 'Monthly',
    },
    {
      name: '50 envelopes',
      credits: 50,
      amount: 'ZAR 400',
      planCode: 'PLN_m0iv4x08zo10128',
      label: 'Monthly',
    },
    {
      name: '100 envelopes',
      credits: 100,
      amount: 'ZAR 750',
      planCode: 'PLN_hhfxiemem179vbl',
      label: 'Monthly',
    },
    {
      name: '200 envelopes',
      credits: 200,
      amount: 'ZAR 1,400',
      planCode: 'PLN_4lu7sf9rbtotr2n',
      label: 'Monthly',
    },
    {
      name: '500 envelopes',
      credits: 500,
      amount: 'ZAR 3,250',
      planCode: 'PLN_b3xu6wzwym77ifa',
      label: 'Monthly',
    },
    {
      name: '1000 envelopes',
      credits: 1000,
      amount: 'ZAR 6,000',
      planCode: 'PLN_sat4vs3qy4btmjj',
      label: 'Monthly',
    },
  ],
  Annual: [
    {
      name: '240 envelopes',
      credits: 240,
      amount: 'ZAR 1,700',
      planCode: 'PLN_9xcixnz5a5kh14x',
      label: 'Annually',
    },
    {
      name: '600 envelopes',
      credits: 600,
      amount: 'ZAR 4,000',
      planCode: 'PLN_aq2fdnx8jpzxnuf',
      label: 'Annually',
    },
    {
      name: '1200 envelopes',
      credits: 1200,
      amount: 'ZAR 7,500',
      planCode: 'PLN_4od24fxbpa947cw',
      label: 'Annually',
    },
    {
      name: '2400 envelopes',
      credits: 2400,
      amount: 'ZAR 14,000',
      planCode: 'PLN_lybvu4aaf5ry1jf',
      label: 'Annually',
    },
    {
      name: '6000 envelopes',
      credits: 6000,
      amount: 'ZAR 32,500',
      planCode: 'PLN_tdlrkbcuxy1w91v',
      label: 'Annually',
    },
    {
      name: '12000 envelopes',
      credits: 12000,
      amount: 'ZAR 60,000',
      planCode: 'PLN_60j0btaxtinfc7j',
      label: 'Annually',
    },
  ],
} as const;

// Use test plans when web URL is sign.nomiadocs.com or localhost
const isTestPaystackEnv = (() => {
  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    return hostname === 'sign.nomiadocs.com' || hostname.includes('localhost');
  } catch {
    // Fallback to includes check if URL parsing fails
    return baseUrl.includes('sign.nomiadocs.com') || baseUrl.includes('localhost');
  }
})();

const plansData = isTestPaystackEnv ? TEST_PLANS_DATA : LIVE_PLANS_DATA;

function PlanCard({
  title,
  plans,
  user,
  onClick,
  activePlanId,
}: {
  title: string | any;
  plans: any;
  user: any;
  onClick: any;
  activePlanId?: any;
}) {
  const [selectedPlan, setSelectedPlan] = useState(plans[0]);
  const [isPaystackLoaded, setIsPaystackLoaded] = useState(false);
  // console.log('Metadata', selectedPlan.credits);
  return (
    <div className="flex w-full flex-col justify-between rounded-xl border p-4 hover:bg-purple-50 md:w-1/3">
      <div className="h-44">
        <h2 className="mb-4 font-semibold text-xl">{title}</h2>
        <h1 className="pb-3 text-gray-500 text-sm">
          <Trans>Select the number of envelopes you require</Trans>
        </h1>
        <div className="mb-4 flex flex-wrap gap-2">
          {plans.map((plan: any) => (
            <button
              key={plan.name}
              onClick={() => setSelectedPlan(plan)}
              className={`rounded-2xl border px-3 py-1 text-sm shadow-md ${
                selectedPlan.name === plan.name
                  ? 'border-teal-400 bg-primary text-white'
                  : activePlanId === plan.planCode
                    ? 'animate-bounce border-teal-300 bg-gradient-to-bl from-green-500 to-blue-500 text-white'
                    : 'border-teal-200 hover:bg-blue-100'
              }`}
            >
              {plan.credits}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-4 rounded-xl bg-purple-50 p-2 text-center font-bold text-muted-foreground text-xl">
          <strong className="text-2xl text-primary">
            {selectedPlan.credits}
            <br />{' '}
          </strong>
          <Trans>Envelopes</Trans>
        </div>

        <div className="mb-4 rounded-xl bg-purple-50 p-2 text-center font-bold text-muted-foreground text-xl">
          <Trans>Price </Trans> <br /> <strong className="text-2xl text-primary">{selectedPlan.amount}</strong>
        </div>
      </div>
      <div className="bottom-0 w-full text-primary text-sm underline duration-200 hover:opacity-70">
        <Button
          className="w-full"
          onClick={() => {
            onClick(
              selectedPlan.label === 'Pay as you go',
              user?.email,
              selectedPlan.amount,
              selectedPlan.planCode,
              selectedPlan.credits,
            );
          }}
        >
          <Trans>Proceed with this subscription</Trans>
        </Button>
      </div>
    </div>
  );
}

export function meta() {
  return appMetaTags(msg`Price Plans`);
}

export default function PricePlansPage({ params, loaderData }: Route.ComponentProps) {
  const { toast } = useToast();
  const { user } = useSession();
  const location = useLocation();
  const revalidator = useRevalidator();

  const { orgUrl } = params;
  const { subscriptions, organisation } = useSuperLoaderData<typeof loader>();
  const currentSubscriptionData: any = subscriptions?.find((data: any) => data.status === 'ACTIVE');
  const activeSubscriptionPlanId = currentSubscriptionData?.priceId;
  const activeSubscriptionCode = currentSubscriptionData?.planId;
  const trxref: any = new URLSearchParams(location.search).get('trxref');

  // State for polling
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling logic when trxref is present
  useEffect(() => {
    if (trxref && !currentSubscriptionData) {
      setIsPolling(true);
      setPollCount(0);

      toast({
        title: 'Processing payment...',
        description: 'Please wait while we confirm your subscription.',
        variant: 'default',
      });

      intervalRef.current = setInterval(() => {
        setPollCount((prev) => {
          const newCount = prev + 1;

          if (newCount >= 20) {
            setIsPolling(false);
            toast({
              title: 'Taking longer than expected',
              description: 'Your payment is being processed. Please refresh the page in a few minutes.',
              variant: 'destructive',
            });

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('trxref');
            window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);

            return newCount;
          }
          revalidator.revalidate();
          return newCount;
        });
      }, 3000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [trxref, currentSubscriptionData, revalidator, toast]);

  useEffect(() => {
    if (trxref && currentSubscriptionData && isPolling) {
      setIsPolling(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Show success toast
      toast({
        title: 'Subscription activated!',
        description: 'Your subscription has been successfully activated.',
        variant: 'default',
      });

      // Clean up URL by removing trxref
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('trxref');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }
  }, [trxref, currentSubscriptionData, isPolling, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getActiveSubscriptionDetails = (planId: string) => {
    // biome-ignore lint/correctness/noUnsafeOptionalChaining: <explanation>
    for (const [_, plans] of Object?.entries(plansData)) {
      const matchedPlan = plans?.find((plan: { planCode: string }) => plan.planCode === planId);
      if (matchedPlan) {
        return matchedPlan;
      }
    }
    return null;
  };

  const activePlanDetails = getActiveSubscriptionDetails(activeSubscriptionPlanId);

  const [isCancelPreviousSubscriptionDialogOpen, setIsCancelPreviousSubscriptionDialogOpen] = useState(false);
  const [pendingNewSubscriptionPlanId, setPendingNewSubscriptionPlanId] = useState<string | null>(null);

  const buildPlusAddressEmail = (email: string, _planId: string) => {
    const atIndex = email.indexOf('@');

    if (atIndex === -1) {
      return email;
    }

    const localPart = email.slice(0, atIndex);
    const domainPart = email.slice(atIndex + 1);

    if (!localPart) {
      return email;
    }

    const randomSuffix = Math.random().toString(36).slice(2, 10);

    if (!randomSuffix) {
      return email;
    }

    return `${localPart}+${randomSuffix}@${domainPart}`;
  };

  async function handleApiPaystack(
    isOneTime: boolean,
    email: string,
    amount: number,
    planId: string,
    metadata?: number,
    reference: null | string = '',
    callback_url: null | string = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${orgUrl}/price-plan`,
  ) {
    if (isOneTime) {
      // console.log('Metadata', metadata);
      handleApiPaystackOneTimeTransaction(email, amount, metadata);
      return;
    }

    const hasActivePaidSubscription = Boolean(currentSubscriptionData) && activePlanDetails?.label !== 'Pay as you go';

    const isTryingToSwitchPlans =
      hasActivePaidSubscription && Boolean(activeSubscriptionPlanId) && activeSubscriptionPlanId !== planId;

    if (isTryingToSwitchPlans) {
      setPendingNewSubscriptionPlanId(planId);
      setIsCancelPreviousSubscriptionDialogOpen(true);
      return;
    }

    const emailForPaystack = buildPlusAddressEmail(email, planId);

    const response = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailForPaystack,
        // With this amount, the user will be able to pay for the plan but original amount will be used as mentioned in the plan details in paystack
        amount: 100,
        plan: planId,
        callback_url: callback_url,
        // Pass credits/envelopes count and organisationId as metadata so webhook can read them
        metadata: {
          ...(metadata ? { value: metadata } : {}),
          organisationId: organisation.id,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || data?.error) {
      console.log('API ERROR', data?.error || data?.message);
      toast({
        title: 'Something went wrong',
        description: data?.error || 'Failed to initialize payment',
        variant: 'destructive',
      });
      return;
    }

    window.location.href = data?.authorization_url;
  }

  async function handleApiPaystackOneTimeTransaction(email: string, amount: any, metadata?: number) {
    const sanitizedAmount = amount.replace(/[^\d]/g, '');
    const response = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/create-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: parseInt(sanitizedAmount) * 100,
        metadata: {
          ...(metadata ? { value: metadata } : {}),
          organisationId: organisation.id,
        },
      }),
    });

    const responseData = await response.json();
    const data = responseData.data;

    if (!response.ok || data?.error || responseData?.error) {
      console.log('API ERROR', data?.error || responseData?.error || responseData?.message);
      toast({
        title: 'Something went wrong',
        description: data?.error || responseData?.error || 'Failed to create transaction',
        variant: 'destructive',
      });
      return;
    }

    window.open(data?.authorization_url, '_blank');
  }

  async function handleApiCancelPaystackSubscription(subscriptionCode: string) {
    const response = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/update-subscription-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('API CANCEL SUBSCRIPTION ERROR', errorData?.message);
    }

    const data = await response.json();

    if (data?.error) {
      toast({
        title: 'Something went wrong',
        description: data?.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Cancellation started',
        description: 'please follow opened url to cancel your subscription',
        variant: 'default',
      });

      window.location.href = data?.link;
    }
  }

  async function handleManageCards(subscriptionCode: string) {
    const response = await fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/update-subscription-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('API CANCEL SUBSCRIPTION ERROR', errorData?.message);
    }

    const data = await response.json();

    if (data?.error) {
      toast({
        title: 'Something went wrong',
        description: data?.error,
        variant: 'destructive',
      });
    } else {
      window.location.href = data?.link;
    }
  }

  if (!organisation) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <h1 className="py-6 font-semibold text-gray-500 text-xl">
          <Trans>Subscriptions are only available to organisation owners.</Trans>
        </h1>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="w-full">
        <Link
          to={`/o/${orgUrl}/settings/general`}
          className="mb-6 inline-flex items-center font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
          <Trans>Back</Trans>
        </Link>

        <Dialog open={isCancelPreviousSubscriptionDialogOpen} onOpenChange={setIsCancelPreviousSubscriptionDialogOpen}>
          <DialogContent className="w-full max-w-lg p-6">
            <DialogHeader>
              <DialogTitle className="font-bold text-primary text-xl">
                <Trans>Cancel current subscription first</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-gray-600 text-sm">
              <p>
                <Trans>
                  You already have an active subscription. To start a new monthly/annual subscription, please cancel
                  your current one first.
                </Trans>
              </p>

              {activePlanDetails?.label && (
                <p className="text-gray-500">
                  <Trans>Current plan:</Trans> <span className="font-medium">{activePlanDetails.label}</span>
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingNewSubscriptionPlanId(null);
                  setIsCancelPreviousSubscriptionDialogOpen(false);
                }}
              >
                <Trans>Close</Trans>
              </Button>

              <Button
                onClick={() => {
                  if (!activeSubscriptionCode) {
                    setIsCancelPreviousSubscriptionDialogOpen(false);
                    setPendingNewSubscriptionPlanId(null);
                    return;
                  }

                  handleApiCancelPaystackSubscription(activeSubscriptionCode);
                  setIsCancelPreviousSubscriptionDialogOpen(false);

                  // Keep pendingNewSubscriptionPlanId so user can click proceed again after cancelling.
                }}
              >
                <Trans>Cancel current subscription</Trans>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Loading indicator when polling */}
        {isPolling && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center space-x-3">
              <div className="h-5 w-5 animate-spin rounded-full border-blue-600 border-b-2"></div>
              <div>
                <p className="font-medium text-blue-800">Processing your subscription...</p>
                <p className="text-blue-600 text-sm">This may take a few moments. Please don't refresh the page.</p>
              </div>
            </div>
          </div>
        )}

        <Dialog>
          <DialogTrigger asChild className="flex w-full items-end justify-end">
            <button className="cursor-pointer pb-6 text-blue-500 text-md underline">
              <Trans>View History</Trans>
            </button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-5xl p-6">
            <DialogHeader>
              <DialogTitle className="font-bold text-2xl text-primary">Subscription History</DialogTitle>
            </DialogHeader>
            <div className="mt-6 overflow-x-auto">
              <Table className="w-full rounded-lg border border-primary/30 shadow-md">
                <TableHeader className="bg-primary/10">
                  <TableRow>
                    <TableHead className="font-semibold text-primary">Name</TableHead>
                    <TableHead className="font-semibold text-primary">Price</TableHead>
                    <TableHead className="font-semibold text-primary">Credits</TableHead>
                    <TableHead className="font-semibold text-primary">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions?.map((sub: any, i: number) => {
                    const planDetails = getActiveSubscriptionDetails(sub.priceId ?? sub.planId);
                    return (
                      <TableRow key={sub.planId ?? i} className="transition hover:bg-muted/50">
                        <TableCell>
                          {planDetails?.label ?? <span className="text-gray-400 italic">Unknown</span>}
                        </TableCell>
                        <TableCell>
                          {planDetails?.amount ?? <span className="text-gray-400 italic">Unknown</span>}
                        </TableCell>
                        <TableCell>
                          {planDetails?.credits ?? <span className="text-gray-400 italic">Unknown</span>}
                        </TableCell>
                        <TableCell>{sub.status === 'PAST_DUE' ? 'INCOMPLETE' : sub.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {currentSubscriptionData && (
          <div>
            <div className="flex w-full items-center justify-between">
              <h1 className="pb-6 font-semibold text-gray-500 text-xl">
                <Trans>Active Subscription</Trans>
              </h1>
            </div>

            <div className="flex h-[25vh] w-full flex-col justify-between rounded-xl border border-purple-500 border-dashed bg-gradient-to-br from-blue-100 to-purple-100 p-4">
              <div>
                <h1 className="font-extrabold text-primary text-xl">
                  <Trans>{activePlanDetails?.label}</Trans>
                </h1>
                <h2 className="text-gray-500 text-xl">
                  <Trans>{activePlanDetails?.name}</Trans>
                </h2>
                <h3 className="text-gray-400 text-lg">
                  <Trans>{activePlanDetails?.amount}</Trans>
                </h3>
              </div>
              <div>
                {activePlanDetails?.label === 'Pay as you go' ? (
                  <h1 className="text-gray-400 text-sm">
                    <Trans>*This is life time envelopes you can use on this platform</Trans>
                  </h1>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => {
                        handleApiCancelPaystackSubscription(activeSubscriptionCode);
                      }}
                      className=""
                    >
                      Cancel subscription
                    </Button>

                    <Button
                      onClick={() => {
                        handleManageCards(activeSubscriptionCode);
                      }}
                      className="bg-gradient-to-br from-pink-400 to-blue-400"
                    >
                      Manage Cards
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <h1 className="py-6 font-semibold text-gray-500 text-xl">
          <Trans>Please select subscription</Trans>
        </h1>

        <div className="flex flex-col gap-4 md:flex-row">
          {Object.entries(plansData).map(([interval, plans]) => (
            <PlanCard
              key={interval}
              title={interval}
              plans={plans}
              user={user}
              onClick={handleApiPaystack}
              activePlanId={activePlanDetails?.planCode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
