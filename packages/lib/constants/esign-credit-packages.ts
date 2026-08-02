import { NEXT_PUBLIC_WEBAPP_URL } from './app';
import { NOMIA_PRICE_PLAN_SEEDS } from './nomia-price-plan-seeds';

const isProduction = NEXT_PUBLIC_WEBAPP_URL()?.includes('e-sign.nomiadocs.com');

export type EsignCreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceInCents: number;
  currency: string;
  displayPrice: string;
  category: 'pay-as-you-go' | 'monthly' | 'annual';
  paystackPlanCode?: string;
};

const formatZarDisplayPrice = (priceInCents: number) => {
  const zar = priceInCents / 100;

  return `ZAR ${zar.toLocaleString('en-ZA', {
    minimumFractionDigits: Number.isInteger(zar) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Sync PAYG catalog fallback built from seed defaults.
 * Prefer `getActiveNomiaPaygPackages()` / `getEsignCreditPackageByIdFromCatalog()` at runtime.
 */
export const ESIGN_CREDIT_PACKAGES: EsignCreditPackage[] = NOMIA_PRICE_PLAN_SEEDS.filter(
  (plan) => plan.category === 'PAYG',
).map((plan) => ({
  id: plan.id,
  name: plan.name,
  credits: plan.credits,
  priceInCents: plan.priceInCents,
  currency: plan.currency,
  displayPrice: formatZarDisplayPrice(plan.priceInCents),
  category: 'pay-as-you-go' as const,
  paystackPlanCode: isProduction ? plan.paystackPlanCodeLive : plan.paystackPlanCodeTest,
}));

export const getEsignCreditPackageById = (catalogPackageId: string) => {
  return ESIGN_CREDIT_PACKAGES.find((pkg) => pkg.id === catalogPackageId);
};

export const RESELLER_MIN_CREDITS_USED = 50;
/** Organisation must be at least this many months old (from signup) to apply. */
export const RESELLER_MIN_SIGNUP_MONTHS = 2;
/** @deprecated Use RESELLER_MIN_SIGNUP_MONTHS */
export const RESELLER_MIN_SUBSCRIPTION_MONTHS = RESELLER_MIN_SIGNUP_MONTHS;
