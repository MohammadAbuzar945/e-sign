import { useEffect, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronLeftIcon } from 'lucide-react';
import { Link, redirect, useLocation, useRevalidator } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  canAccessInvoiceHistory,
  canAccessResellerBulkTools,
  canAccessResellerCheckout,
  isDemoFeatureVisible,
  RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
} from '@documenso/lib/constants/demo-feature-flags';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getOrganisationBillingAttributionSummary } from '@documenso/lib/server-only/reseller/resolve-organisation-payg-billing';
import { resolveOrganisationBillingPath } from '@documenso/lib/utils/organisation-billing-path';
import { prisma } from '@documenso/prisma';
import { useSession } from '@documenso/lib/client-only/providers/session';
import {
  getNomiaPricePlansUiCatalog,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { getOrganisationPurchaseHistory } from '@documenso/lib/server-only/billing/get-organisation-purchase-history';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { OrganisationPurchaseHistoryDialog } from '~/components/general/organisation-purchase-history-dialog';
import { ResellerBulkInventoryPurchase } from '~/components/general/reseller-bulk-inventory-purchase';
import { appMetaTags } from '~/utils/meta';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/o.$orgUrl.price-plan';

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

  const url = new URL(request.url);
  const isHybridNomiaRemainder = url.searchParams.get('hybrid') === 'nomia';
  const isResellerUnavailableFallback = url.searchParams.get('resellerUnavailable') === '1';

  // Affiliate signup / purchase customers should land on /r/{slug}, not Nomia price-plan.
  // Keep explicit fallback/hybrid callbacks on this page to avoid redirect loops.
  if (!isHybridNomiaRemainder && !isResellerUnavailableFallback) {
    const billingAttribution = await getOrganisationBillingAttributionSummary(organisation.id);
    const billingPath = resolveOrganisationBillingPath({
      organisationUrl: organisation.url,
      billingAttribution,
    });
    const defaultPricePlanPath = `/o/${organisation.url}/price-plan`;

    if (billingPath !== defaultPricePlanPath) {
      throw redirect(billingPath);
    }
  }

  const canViewInvoiceHistory = canAccessInvoiceHistory(user.email);

  const [subscriptions, purchaseHistory, resellerProfile, plansData] = await Promise.all([
    getSubscriptionsByUserId({ organisationId: organisation.id }),
    canViewInvoiceHistory
      ? getOrganisationPurchaseHistory({ organisationId: organisation.id })
      : Promise.resolve([]),
    prisma.resellerProfile.findUnique({
      where: { organisationId: organisation.id },
      select: { id: true, status: true },
    }),
    getNomiaPricePlansUiCatalog(),
  ]);

  return superLoaderJson({
    subscriptions,
    purchaseHistory,
    user,
    organisation,
    isActiveReseller: resellerProfile?.status === 'ACTIVE',
    canViewInvoiceHistory,
    plansData,
  });
};

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
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        <h1 className="pb-3 text-sm text-gray-500">
          <Trans>Select the number of envelopes you require</Trans>
        </h1>
        <div className="mb-4 flex flex-wrap gap-2">
          {plans.map((plan: any) => (
            <button
              key={plan.name}
              onClick={() => setSelectedPlan(plan)}
              className={`rounded-2xl border px-3 py-1 text-sm shadow-md ${
                selectedPlan.name === plan.name
                  ? 'bg-primary border-teal-400 text-white'
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
        <div className="text-muted-foreground mb-4 rounded-xl bg-purple-50 p-2 text-center text-xl font-bold">
          <strong className="text-primary text-2xl">
            {selectedPlan.credits}
            <br />{' '}
          </strong>
          <Trans>Envelopes</Trans>
        </div>

        <div className="text-muted-foreground mb-4 rounded-xl bg-purple-50 p-2 text-center text-xl font-bold">
          <Trans>Price </Trans> <br />{' '}
          <strong className="text-primary text-2xl">{selectedPlan.amount}</strong>
        </div>
      </div>
      <div className="text-primary bottom-0 w-full text-sm underline duration-200 hover:opacity-70">
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
  return appMetaTags('Price Plans');
}

export default function PricePlansPage({ params, loaderData }: Route.ComponentProps) {
  const { toast } = useToast();
  const { _ } = useLingui();
  const { user } = useSession();
  const location = useLocation();
  const revalidator = useRevalidator();

  const { orgUrl } = params;
  const {
    subscriptions,
    purchaseHistory,
    organisation,
    isActiveReseller,
    canViewInvoiceHistory,
    plansData,
  } = useSuperLoaderData<typeof loader>();
  const currentSubscriptionData: any = subscriptions?.find((data: any) => data.status === 'ACTIVE');
  const activeSubscriptionPlanId = currentSubscriptionData?.priceId;
  const activeSubscriptionCode = currentSubscriptionData?.planId;
  const searchParams = new URLSearchParams(location.search);
  const trxref: any = searchParams.get('trxref');
  // Credit/top-up purchases (including reseller purchases fulfilled by Nomia) return with a
  // `purchase` query param. These do NOT create a subscription, so they must not trigger the
  // subscription activation polling below (which would otherwise spin forever).
  const purchaseParam = searchParams.get('purchase');
  const isCreditPurchaseCallback = Boolean(trxref) && Boolean(purchaseParam);

  // State for polling
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartedRef = useRef(false);
  const creditPurchaseHandledRef = useRef(false);

  // Keep the latest revalidator/toast without retriggering the polling effect. Having
  // `revalidator` in the effect deps previously reset the poll counter on every revalidation,
  // which prevented the poll from ever completing or timing out.
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Credit purchase callback: acknowledge success and refresh credits/history once.
  useEffect(() => {
    if (!isCreditPurchaseCallback || creditPurchaseHandledRef.current) {
      return;
    }

    creditPurchaseHandledRef.current = true;

    toastRef.current({
      title: 'Payment successful',
      description: 'Your credits have been added to your organisation.',
      variant: 'default',
    });

    revalidatorRef.current.revalidate();

    const newUrl = new URL(window.location.href);
    for (const key of [
      'trxref',
      'reference',
      'purchase',
      'hybrid',
      'catalogPackageId',
      'nomiaCredits',
      'nomiaAmount',
      'purchaseGroupId',
    ]) {
      newUrl.searchParams.delete(key);
    }
    window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
  }, [isCreditPurchaseCallback]);

  // Subscription checkout callback: poll until the subscription becomes active.
  useEffect(() => {
    if (trxref && !purchaseParam && !currentSubscriptionData && !pollingStartedRef.current) {
      pollingStartedRef.current = true;
      setIsPolling(true);
      setPollCount(0);

      toastRef.current({
        title: 'Processing payment...',
        description: 'Please wait while we confirm your subscription.',
        variant: 'default',
      });

      intervalRef.current = setInterval(() => {
        setPollCount((prev) => {
          const newCount = prev + 1;

          if (newCount >= 20) {
            setIsPolling(false);

            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }

            toastRef.current({
              title: 'Taking longer than expected',
              description:
                'Your payment is being processed. Please refresh the page in a few minutes.',
              variant: 'destructive',
            });

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('trxref');
            window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);

            return newCount;
          }

          revalidatorRef.current.revalidate();
          return newCount;
        });
      }, 3000);
    }
  }, [trxref, purchaseParam, currentSubscriptionData]);

  useEffect(() => {
    if (trxref && !purchaseParam && currentSubscriptionData && isPolling) {
      setIsPolling(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Show success toast
      toastRef.current({
        title: 'Subscription activated!',
        description: 'Your subscription has been successfully activated.',
        variant: 'default',
      });

      // Clean up URL by removing trxref
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('trxref');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }
  }, [trxref, purchaseParam, currentSubscriptionData, isPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getActiveSubscriptionDetails = (planId: string) => {
    for (const [_, plans] of Object?.entries(plansData)) {
      const matchedPlan = plans?.find((plan: { planCode: string; }) => plan.planCode === planId);
      if (matchedPlan) return matchedPlan;
    }
    return null;
  };

  const activePlanDetails = getActiveSubscriptionDetails(activeSubscriptionPlanId);

  const [isCancelPreviousSubscriptionDialogOpen, setIsCancelPreviousSubscriptionDialogOpen] =
    useState(false);
  const [pendingNewSubscriptionPlanId, setPendingNewSubscriptionPlanId] = useState<string | null>(
    null,
  );

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
    if (!canAccessResellerCheckout(user.email)) {
      toast({
        title: _(msg`Coming soon`),
        description: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
      });
      return;
    }

    if (isOneTime) {
      handleApiPaystackOneTimeTransaction(email, amount, metadata);
      return;
    }

    const hasActivePaidSubscription =
      Boolean(currentSubscriptionData) && activePlanDetails?.label !== 'Pay as you go';

    const isTryingToSwitchPlans =
      hasActivePaidSubscription &&
      Boolean(activeSubscriptionPlanId) &&
      activeSubscriptionPlanId !== planId;

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

  async function handleApiPaystackOneTimeTransaction(
    email: string,
    amount: any,
    metadata?: number,
  ) {
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
    const response = await fetch(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/update-subscription-link`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          subscriptionCode,
        }),
      },
    );

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
    const response = await fetch(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/paystack/update-subscription-link`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          subscriptionCode,
        }),
      },
    );

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
        <h1 className="py-6 text-xl font-semibold text-gray-500">
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
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm font-medium transition-colors"
        >
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
          <Trans>Back</Trans>
        </Link>

        <Dialog
          open={isCancelPreviousSubscriptionDialogOpen}
          onOpenChange={setIsCancelPreviousSubscriptionDialogOpen}
        >
          <DialogContent className="w-full max-w-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-primary text-xl font-bold">
                <Trans>Cancel current subscription first</Trans>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <Trans>
                  You already have an active subscription. To start a new monthly/annual subscription,
                  please cancel your current one first.
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
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <div>
                <p className="font-medium text-blue-800">Processing your subscription...</p>
                <p className="text-sm text-blue-600">
                  This may take a few moments. Please don't refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}

        <OrganisationPurchaseHistoryDialog
          orgUrl={orgUrl}
          purchaseHistory={purchaseHistory}
          isComingSoon={!canViewInvoiceHistory}
          getSubscriptionPlanDetails={getActiveSubscriptionDetails}
        />

        {currentSubscriptionData && (
          <div>
            <div className="flex w-full items-center justify-between">
              <h1 className="pb-6 text-xl font-semibold text-gray-500">
                <Trans>Active Subscription</Trans>
              </h1>
            </div>

            <div className="flex h-[25vh] w-full flex-col justify-between rounded-xl border border-dashed border-purple-500 bg-gradient-to-br from-blue-100 to-purple-100 p-4">
              <div>
                <h1 className="text-primary text-xl font-extrabold">
                  <Trans>{activePlanDetails?.label}</Trans>
                </h1>
                <h2 className="text-xl text-gray-500">
                  <Trans>{activePlanDetails?.name}</Trans>
                </h2>
                <h3 className="text-lg text-gray-400">
                  <Trans>{activePlanDetails?.amount}</Trans>
                </h3>
              </div>
              <div>
                {activePlanDetails?.label === 'Pay as you go' ? (
                  <h1 className="text-sm text-gray-400">
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

        <h1 className="py-6 text-xl font-semibold text-gray-500">
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

        {isActiveReseller &&
        isDemoFeatureVisible('RESELLER_USER_FACING') &&
        canAccessResellerBulkTools() ? (
          <div className="mt-8">
            <ResellerBulkInventoryPurchase organisationId={organisation.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
