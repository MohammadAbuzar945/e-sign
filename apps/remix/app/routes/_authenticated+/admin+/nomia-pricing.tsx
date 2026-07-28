import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { Link, redirect, useLocation, useSearchParams } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { canAccessNomiaPricing } from '@documenso/lib/constants/demo-feature-flags';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  AdminNomiaPricingEditor,
  type NomiaPricePlanDraft,
} from '~/components/general/admin-nomia-pricing-editor';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

const PRICING_VIEW = {
  PAYG: 'payg',
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const;

type PricingView = (typeof PRICING_VIEW)[keyof typeof PRICING_VIEW];

const isPricingView = (value: string | null): value is PricingView =>
  value === PRICING_VIEW.PAYG || value === PRICING_VIEW.MONTHLY || value === PRICING_VIEW.ANNUAL;

const viewToCategory = (view: PricingView): NomiaPricePlanDraft['category'] => {
  if (view === PRICING_VIEW.MONTHLY) {
    return 'MONTHLY';
  }

  if (view === PRICING_VIEW.ANNUAL) {
    return 'ANNUAL';
  }

  return 'PAYG';
};

export function meta() {
  return appMetaTags('Nomia pricing');
}

export async function loader({ request }: { request: Request }) {
  const { user } = await getSession(request);

  if (!canAccessNomiaPricing(user.email)) {
    throw redirect('/admin');
  }

  return null;
}

export default function AdminNomiaPricingPage() {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const utils = trpc.useUtils();

  const currentView = isPricingView(searchParams.get('view'))
    ? searchParams.get('view')!
    : PRICING_VIEW.PAYG;

  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, isError } = trpc.admin.nomiaPricing.getMany.useQuery();

  const plans = useMemo<NomiaPricePlanDraft[]>(() => data?.plans ?? [], [data?.plans]);

  const getTabHref = (view: PricingView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);

    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  };

  const { mutateAsync: updatePlans } = trpc.admin.nomiaPricing.updateMany.useMutation();

  const handleSave = async (categoryPlans: NomiaPricePlanDraft[]) => {
    setIsSaving(true);

    try {
      await updatePlans({
        plans: categoryPlans.map((plan) => ({
          id: plan.id,
          credits: plan.credits,
          priceInCents: plan.priceInCents,
          isEnabled: plan.isEnabled,
          paystackPlanCodeTest: plan.paystackPlanCodeTest,
          paystackPlanCodeLive: plan.paystackPlanCodeLive,
        })),
      });

      await utils.admin.nomiaPricing.getMany.invalidate();

      toast({
        title: _(msg`Pricing updated`),
        description: _(msg`Nomia catalog changes were saved.`),
      });
    } catch (error) {
      const parsed = AppError.parseError(error);

      toast({
        title: _(msg`Unable to save pricing`),
        description: parsed.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0">
      <SettingsHeader
        title={_(msg`Nomia pricing`)}
        subtitle={_(
          msg`Edit pay-as-you-go, monthly, and annual credits and prices. Existing subscribers keep their current Paystack plan until they re-subscribe.`,
        )}
      />

      <Alert className="mb-6" variant="secondary">
        <AlertTitle>
          <Trans>Paystack sync required</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>
            Changing monthly or annual prices requires creating or updating the Paystack plan, then
            pasting the new plan code here. PAYG has no Paystack plans — only credits and price are
            edited, and checkout uses create-transaction with the saved price.
          </Trans>
        </AlertDescription>
      </Alert>

      <Tabs value={currentView} className="mb-6">
        <TabsList>
          <TabsTrigger value={PRICING_VIEW.PAYG} asChild>
            <Link to={getTabHref(PRICING_VIEW.PAYG)}>
              <Trans>Pay as you go</Trans>
            </Link>
          </TabsTrigger>
          <TabsTrigger value={PRICING_VIEW.MONTHLY} asChild>
            <Link to={getTabHref(PRICING_VIEW.MONTHLY)}>
              <Trans>Monthly</Trans>
            </Link>
          </TabsTrigger>
          <TabsTrigger value={PRICING_VIEW.ANNUAL} asChild>
            <Link to={getTabHref(PRICING_VIEW.ANNUAL)}>
              <Trans>Annual</Trans>
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            <Trans>Unable to load pricing</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>The Nomia pricing catalog failed to load. Please try again.</Trans>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !isError ? (
        <AdminNomiaPricingEditor
          category={viewToCategory(currentView)}
          initialPlans={plans}
          isSaving={isSaving}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
