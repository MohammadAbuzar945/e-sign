export type NomiaSubscriptionPlanDetails = {
  planCode: string;
  name: string;
  label: 'Monthly' | 'Annually';
  credits: number;
  /** Amount charged in ZAR cents. */
  priceInCents: number;
};

/**
 * Catalog of Nomia monthly/annual Paystack plans used for invoices and purchase history.
 * Includes both test and live plan codes.
 */
export const NOMIA_SUBSCRIPTION_PLANS: NomiaSubscriptionPlanDetails[] = [
  // Test monthly
  { planCode: 'PLN_1croxh14pyq4cj7', name: '20 envelopes', label: 'Monthly', credits: 20, priceInCents: 17000 },
  { planCode: 'PLN_zel9llutx085dp9', name: '50 envelopes', label: 'Monthly', credits: 50, priceInCents: 40000 },
  { planCode: 'PLN_yvo5ujkxt1diiak', name: '100 envelopes', label: 'Monthly', credits: 100, priceInCents: 75000 },
  { planCode: 'PLN_0oqk4fljy5uais0', name: '200 envelopes', label: 'Monthly', credits: 200, priceInCents: 140000 },
  { planCode: 'PLN_27yc6cxtga9huy7', name: '500 envelopes', label: 'Monthly', credits: 500, priceInCents: 325000 },
  { planCode: 'PLN_q4qbiwreibc8qr5', name: '1000 envelopes', label: 'Monthly', credits: 1000, priceInCents: 600000 },

  // Test annual
  { planCode: 'PLN_coac3n7m4jo59ct', name: '240 envelopes', label: 'Annually', credits: 240, priceInCents: 170000 },
  { planCode: 'PLN_8kh731h1ojcx37d', name: '600 envelopes', label: 'Annually', credits: 600, priceInCents: 400000 },
  { planCode: 'PLN_tzngz1lbhvxnufb', name: '1200 envelopes', label: 'Annually', credits: 1200, priceInCents: 750000 },
  { planCode: 'PLN_kn6j6ur12pedilo', name: '2400 envelopes', label: 'Annually', credits: 2400, priceInCents: 1400000 },
  { planCode: 'PLN_moko1x694rvm5l8', name: '6000 envelopes', label: 'Annually', credits: 6000, priceInCents: 3300000 },
  { planCode: 'PLN_scnf05tt3vrui2i', name: '12000 envelopes', label: 'Annually', credits: 12000, priceInCents: 6000000 },

  // Live monthly
  { planCode: 'PLN_4yptquhayqxdx68', name: '20 envelopes', label: 'Monthly', credits: 20, priceInCents: 17000 },
  { planCode: 'PLN_m0iv4x08zo10128', name: '50 envelopes', label: 'Monthly', credits: 50, priceInCents: 40000 },
  { planCode: 'PLN_hhfxiemem179vbl', name: '100 envelopes', label: 'Monthly', credits: 100, priceInCents: 75000 },
  { planCode: 'PLN_4lu7sf9rbtotr2n', name: '200 envelopes', label: 'Monthly', credits: 200, priceInCents: 140000 },
  { planCode: 'PLN_b3xu6wzwym77ifa', name: '500 envelopes', label: 'Monthly', credits: 500, priceInCents: 325000 },
  { planCode: 'PLN_sat4vs3qy4btmjj', name: '1000 envelopes', label: 'Monthly', credits: 1000, priceInCents: 600000 },

  // Live annual
  { planCode: 'PLN_9xcixnz5a5kh14x', name: '240 envelopes', label: 'Annually', credits: 240, priceInCents: 170000 },
  { planCode: 'PLN_aq2fdnx8jpzxnuf', name: '600 envelopes', label: 'Annually', credits: 600, priceInCents: 400000 },
  { planCode: 'PLN_4od24fxbpa947cw', name: '1200 envelopes', label: 'Annually', credits: 1200, priceInCents: 750000 },
  { planCode: 'PLN_lybvu4aaf5ry1jf', name: '2400 envelopes', label: 'Annually', credits: 2400, priceInCents: 1400000 },
  { planCode: 'PLN_tdlrkbcuxy1w91v', name: '6000 envelopes', label: 'Annually', credits: 6000, priceInCents: 3250000 },
  { planCode: 'PLN_60j0btaxtinfc7j', name: '12000 envelopes', label: 'Annually', credits: 12000, priceInCents: 6000000 },
];

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
