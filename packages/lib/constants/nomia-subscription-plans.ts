import { NOMIA_PRICE_PLAN_SEEDS } from './nomia-price-plan-seeds';

export type NomiaSubscriptionPlanDetails = {
  planCode: string;
  name: string;
  label: 'Monthly' | 'Annually';
  credits: number;
  /** Amount charged in ZAR cents. */
  priceInCents: number;
};

/**
 * Sync seed catalog of Nomia monthly/annual Paystack plans (invoices / history fallback).
 * Prefer `getNomiaSubscriptionPlanDetailsFromCatalog()` at runtime.
 */
export const NOMIA_SUBSCRIPTION_PLANS: NomiaSubscriptionPlanDetails[] =
  NOMIA_PRICE_PLAN_SEEDS.filter((plan) => plan.category === 'MONTHLY' || plan.category === 'ANNUAL')
    .flatMap((plan) => {
      const label = plan.category === 'MONTHLY' ? ('Monthly' as const) : ('Annually' as const);

      return [
        plan.paystackPlanCodeTest
          ? {
              planCode: plan.paystackPlanCodeTest,
              name: plan.name,
              label,
              credits: plan.credits,
              priceInCents: plan.priceInCents,
            }
          : null,
        plan.paystackPlanCodeLive
          ? {
              planCode: plan.paystackPlanCodeLive,
              name: plan.name,
              label,
              credits: plan.credits,
              priceInCents: plan.priceInCents,
            }
          : null,
      ].filter((item): item is NomiaSubscriptionPlanDetails => item !== null);
    });

const NOMIA_SUBSCRIPTION_PLANS_BY_CODE = Object.fromEntries(
  NOMIA_SUBSCRIPTION_PLANS.map((plan) => [plan.planCode, plan]),
) as Record<string, NomiaSubscriptionPlanDetails>;

export const getNomiaSubscriptionPlanDetails = (
  planCode: string | null | undefined,
): NomiaSubscriptionPlanDetails | null => {
  if (!planCode) {
    return null;
  }

  return NOMIA_SUBSCRIPTION_PLANS_BY_CODE[planCode] ?? null;
};

/**
 * Resolve plan details for a subscription charge invoice (activation or renewal).
 * Prefer the Paystack plan code; fall back to matching credits + charged amount.
 */
export const findNomiaSubscriptionPlanForCharge = ({
  planCode,
  credits,
  priceInCents,
}: {
  planCode?: string | null;
  credits?: number | null;
  priceInCents?: number | null;
}): NomiaSubscriptionPlanDetails | null => {
  const byCode = getNomiaSubscriptionPlanDetails(planCode);

  if (byCode) {
    return byCode;
  }

  if (credits == null || priceInCents == null) {
    return null;
  }

  return (
    NOMIA_SUBSCRIPTION_PLANS.find(
      (plan) => plan.credits === credits && plan.priceInCents === priceInCents,
    ) ?? null
  );
};

export const formatNomiaSubscriptionPlanTitle = (
  plan: NomiaSubscriptionPlanDetails | null | undefined,
  fallback = 'Subscription',
) => (plan ? `${plan.label} — ${plan.name}` : fallback);
