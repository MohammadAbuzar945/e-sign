import { NEXT_PUBLIC_WEBAPP_URL } from './app';

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
  paystackPaymentUrl?: string;
};

const TEST_PAY_AS_YOU_GO_REDIRECTS: Record<number, string> = {
  20: 'https://paystack.shop/pay/testqoiw2m',
  50: 'https://paystack.shop/pay/guc0g9s57q',
  100: 'https://paystack.shop/pay/dfpu1arzjn',
  200: 'https://paystack.shop/pay/c4jdb6jsv7',
  500: 'https://paystack.shop/pay/bpbblrunck',
  1000: 'https://paystack.shop/pay/q2shmym9rjg',
};

const LIVE_PAY_AS_YOU_GO_REDIRECTS: Record<number, string> = {
  20: 'https://paystack.shop/pay/t1tt334q2r',
  50: 'https://paystack.shop/pay/x0njhbshus',
  100: 'https://paystack.shop/pay/nom51ao6dn',
  200: 'https://paystack.shop/pay/pkxnaia58b',
  500: 'https://paystack.shop/pay/jk53idasm2',
  1000: 'https://paystack.shop/pay/u1d7onwlr',
};

const payAsYouGoRedirects = isProduction ? LIVE_PAY_AS_YOU_GO_REDIRECTS : TEST_PAY_AS_YOU_GO_REDIRECTS;

const buildPayAsYouGoPackages = (
  planCodes: Record<number, string>,
): EsignCreditPackage[] => [
  {
    id: 'payg-20',
    name: '20 envelopes',
    credits: 20,
    priceInCents: 19000,
    currency: 'ZAR',
    displayPrice: 'ZAR 190',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[20],
    paystackPaymentUrl: payAsYouGoRedirects[20],
  },
  {
    id: 'payg-50',
    name: '50 envelopes',
    credits: 50,
    priceInCents: 45000,
    currency: 'ZAR',
    displayPrice: 'ZAR 450',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[50],
    paystackPaymentUrl: payAsYouGoRedirects[50],
  },
  {
    id: 'payg-100',
    name: '100 envelopes',
    credits: 100,
    priceInCents: 85000,
    currency: 'ZAR',
    displayPrice: 'ZAR 850',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[100],
    paystackPaymentUrl: payAsYouGoRedirects[100],
  },
  {
    id: 'payg-200',
    name: '200 envelopes',
    credits: 200,
    priceInCents: 160000,
    currency: 'ZAR',
    displayPrice: 'ZAR 1,600',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[200],
    paystackPaymentUrl: payAsYouGoRedirects[200],
  },
  {
    id: 'payg-500',
    name: '500 envelopes',
    credits: 500,
    priceInCents: 375000,
    currency: 'ZAR',
    displayPrice: 'ZAR 3,750',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[500],
    paystackPaymentUrl: payAsYouGoRedirects[500],
  },
  {
    id: 'payg-1000',
    name: '1000 envelopes',
    credits: 1000,
    priceInCents: 700000,
    currency: 'ZAR',
    displayPrice: 'ZAR 7,000',
    category: 'pay-as-you-go',
    paystackPlanCode: planCodes[1000],
    paystackPaymentUrl: payAsYouGoRedirects[1000],
  },
];

const TEST_PLAN_CODES: Record<number, string> = {
  20: 'PLN_bit1oy0ayiqpkdu',
  50: 'PLN_59961ig3ply5r3s',
  100: 'PLN_ktbomtrjkiz73i1',
  200: 'PLN_kxqcw02dow71g6c',
  500: 'PLN_5nmok91ploz44u6',
  1000: 'PLN_f54sm9jv38v7r5m',
};

const LIVE_PLAN_CODES: Record<number, string> = {
  20: 'PLN_qcz1c2zdiyk3lw3',
  50: 'PLN_jw0og1p6hc4oz9d',
  100: 'PLN_arl2oksyipcd4aq',
  200: 'PLN_y1fcc9z6et50sx3',
  500: 'PLN_9n7qj5gj3462buu',
  1000: 'PLN_aiohn8rtai2dtq1',
};

export const ESIGN_CREDIT_PACKAGES: EsignCreditPackage[] = buildPayAsYouGoPackages(
  isProduction ? LIVE_PLAN_CODES : TEST_PLAN_CODES,
);

export const getEsignCreditPackageById = (catalogPackageId: string) => {
  return ESIGN_CREDIT_PACKAGES.find((pkg) => pkg.id === catalogPackageId);
};

export const RESELLER_MIN_CREDITS_USED = 50;
/** Organisation must be at least this many months old (from signup) to apply. */
export const RESELLER_MIN_SIGNUP_MONTHS = 2;
/** @deprecated Use RESELLER_MIN_SIGNUP_MONTHS */
export const RESELLER_MIN_SUBSCRIPTION_MONTHS = RESELLER_MIN_SIGNUP_MONTHS;

/** Emails that can access restricted reseller demo extras (checkout, bulk, admin tools, invoices). */
export const RESELLER_FEATURE_ALLOWED_EMAILS = [
  'awanabuzar945@gmail.com',
  'abuzarofficial945@gmail.com',
] as const;

/** @deprecated Use RESELLER_FEATURE_ALLOWED_EMAILS / canAccessResellerDemoExtras */
export const RESELLER_ELIGIBILITY_BYPASS_EMAILS = RESELLER_FEATURE_ALLOWED_EMAILS;

const RESELLER_E2E_TEST_EMAIL_DOMAIN = 'test.nomiadocs.com';

/**
 * Whether the email may use restricted reseller demo extras
 * (not a gate for seeing/applying to the reseller programme).
 */
export const isResellerFeatureAllowedEmail = (email: string) => {
  const normalizedEmail = email.toLowerCase();

  if ((RESELLER_FEATURE_ALLOWED_EMAILS as readonly string[]).includes(normalizedEmail)) {
    return true;
  }

  if (!isProduction && normalizedEmail.endsWith(`@${RESELLER_E2E_TEST_EMAIL_DOMAIN}`)) {
    return true;
  }

  return false;
};

/** Allowlisted emails bypass credits/tenure eligibility requirements. */
export const isResellerEligibilityBypassEmail = isResellerFeatureAllowedEmail;
