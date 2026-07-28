import { NomiaPricePlanCategory, type NomiaPricePlan } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { EsignCreditPackage } from '@documenso/lib/constants/esign-credit-packages';
import type { NomiaSubscriptionPlanDetails } from '@documenso/lib/constants/nomia-subscription-plans';
import {
  findNomiaSubscriptionPlanForCharge,
  getNomiaSubscriptionPlanDetails,
} from '@documenso/lib/constants/nomia-subscription-plans';
import {
  NOMIA_PRICE_PLAN_SEED_IDS,
  NOMIA_PRICE_PLAN_SEEDS,
  type NomiaPricePlanSeed,
} from '@documenso/lib/constants/nomia-price-plan-seeds';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type NomiaPricePlanRow = {
  id: string;
  category: NomiaPricePlanCategory;
  name: string;
  credits: number;
  priceInCents: number;
  currency: string;
  paystackPlanCodeTest: string;
  paystackPlanCodeLive: string;
  paystackPaymentUrlTest: string | null;
  paystackPaymentUrlLive: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

export type NomiaPricePlanUiItem = {
  catalogPackageId: string;
  name: string;
  credits: number;
  amount: string;
  planCode: string;
  label: 'Pay as you go' | 'Monthly' | 'Annually';
};

export type NomiaPricePlansUiCatalog = {
  'Pay-as-you-go / Top-up': NomiaPricePlanUiItem[];
  Monthly: NomiaPricePlanUiItem[];
  Annual: NomiaPricePlanUiItem[];
};

export type UpdateNomiaPricePlanInput = {
  id: string;
  credits: number;
  priceInCents: number;
  isEnabled: boolean;
  paystackPlanCodeTest: string;
  paystackPlanCodeLive: string;
};

const formatZarDisplayPrice = (priceInCents: number) => {
  const zar = priceInCents / 100;

  return `ZAR ${zar.toLocaleString('en-ZA', {
    minimumFractionDigits: Number.isInteger(zar) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const seedToRow = (seed: NomiaPricePlanSeed): NomiaPricePlanRow => ({
  id: seed.id,
  category: seed.category as NomiaPricePlanCategory,
  name: seed.name,
  credits: seed.credits,
  priceInCents: seed.priceInCents,
  currency: seed.currency,
  paystackPlanCodeTest: seed.paystackPlanCodeTest,
  paystackPlanCodeLive: seed.paystackPlanCodeLive,
  paystackPaymentUrlTest: seed.paystackPaymentUrlTest,
  paystackPaymentUrlLive: seed.paystackPaymentUrlLive,
  isEnabled: seed.isEnabled,
  sortOrder: seed.sortOrder,
});

const mapDbRow = (row: NomiaPricePlan): NomiaPricePlanRow => ({
  id: row.id,
  category: row.category,
  name: row.name,
  credits: row.credits,
  priceInCents: row.priceInCents,
  currency: row.currency,
  paystackPlanCodeTest: row.paystackPlanCodeTest,
  paystackPlanCodeLive: row.paystackPlanCodeLive,
  paystackPaymentUrlTest: row.paystackPaymentUrlTest,
  paystackPaymentUrlLive: row.paystackPaymentUrlLive,
  isEnabled: row.isEnabled,
  sortOrder: row.sortOrder,
});

export const isNomiaTestPaystackEnv = (baseUrl = NEXT_PUBLIC_WEBAPP_URL()) => {
  try {
    const hostname = new URL(baseUrl).hostname;

    return hostname === 'sign.nomiadocs.com' || hostname.includes('localhost');
  } catch {
    return baseUrl.includes('sign.nomiadocs.com') || baseUrl.includes('localhost');
  }
};

export const isNomiaLivePaystackEnv = (baseUrl = NEXT_PUBLIC_WEBAPP_URL()) =>
  !isNomiaTestPaystackEnv(baseUrl);

/**
 * List all Nomia price plans (admin). Falls back to seed constants if DB empty.
 */
export const listNomiaPricePlans = async (): Promise<NomiaPricePlanRow[]> => {
  const rows = await prisma.nomiaPricePlan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (rows.length === 0) {
    return NOMIA_PRICE_PLAN_SEEDS.map(seedToRow);
  }

  return rows.map(mapDbRow);
};

const ensureSeededIfEmpty = async () => {
  const count = await prisma.nomiaPricePlan.count();

  if (count > 0) {
    return;
  }

  await prisma.nomiaPricePlan.createMany({
    data: NOMIA_PRICE_PLAN_SEEDS.map((seed) => ({
      id: seed.id,
      category: seed.category as NomiaPricePlanCategory,
      name: seed.name,
      credits: seed.credits,
      priceInCents: seed.priceInCents,
      currency: seed.currency,
      paystackPlanCodeTest: seed.paystackPlanCodeTest,
      paystackPlanCodeLive: seed.paystackPlanCodeLive,
      paystackPaymentUrlTest: seed.paystackPaymentUrlTest,
      paystackPaymentUrlLive: seed.paystackPaymentUrlLive,
      isEnabled: seed.isEnabled,
      sortOrder: seed.sortOrder,
    })),
    skipDuplicates: true,
  });
};

export const updateNomiaPricePlans = async (
  updates: UpdateNomiaPricePlanInput[],
): Promise<NomiaPricePlanRow[]> => {
  await ensureSeededIfEmpty();

  const unknownIds = updates
    .map((item) => item.id)
    .filter((id) => !NOMIA_PRICE_PLAN_SEED_IDS.includes(id));

  if (unknownIds.length > 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Unknown price plan ids: ${unknownIds.join(', ')}`,
    });
  }

  const existing = await prisma.nomiaPricePlan.findMany({
    where: { id: { in: updates.map((item) => item.id) } },
    select: { id: true, category: true },
  });

  const existingById = new Map(existing.map((item) => [item.id, item]));
  const missing = updates.map((item) => item.id).filter((id) => !existingById.has(id));

  if (missing.length > 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Price plans not found: ${missing.join(', ')}`,
    });
  }

  await prisma.$transaction(
    updates.map((item) => {
      const current = existingById.get(item.id)!;
      const isPayg = current.category === 'PAYG';

      return prisma.nomiaPricePlan.update({
        where: { id: item.id },
        data: {
          credits: item.credits,
          priceInCents: item.priceInCents,
          isEnabled: item.isEnabled,
          ...(isPayg
            ? {}
            : {
                paystackPlanCodeTest: item.paystackPlanCodeTest.trim(),
                paystackPlanCodeLive: item.paystackPlanCodeLive.trim(),
              }),
        },
      });
    }),
  );

  return listNomiaPricePlans();
};

const toEsignPackage = (
  row: NomiaPricePlanRow,
  useLive: boolean,
): EsignCreditPackage => {
  const priceInCents = row.priceInCents;

  return {
    id: row.id,
    name: row.name,
    credits: row.credits,
    priceInCents,
    currency: row.currency,
    displayPrice: formatZarDisplayPrice(priceInCents),
    category:
      row.category === 'PAYG'
        ? 'pay-as-you-go'
        : row.category === 'MONTHLY'
          ? 'monthly'
          : 'annual',
    paystackPlanCode: useLive ? row.paystackPlanCodeLive : row.paystackPlanCodeTest,
  };
};

/**
 * Active catalog packages for the current env (PAYG + subscriptions).
 */
export const getActiveNomiaCatalog = async ({
  enabledOnly = true,
  useLive = isNomiaLivePaystackEnv(),
}: {
  enabledOnly?: boolean;
  useLive?: boolean;
} = {}): Promise<EsignCreditPackage[]> => {
  const rows = await listNomiaPricePlans();

  return rows
    .filter((row) => (enabledOnly ? row.isEnabled : true))
    .map((row) => toEsignPackage(row, useLive));
};

export const getActiveNomiaPaygPackages = async (): Promise<EsignCreditPackage[]> => {
  const catalog = await getActiveNomiaCatalog();

  return catalog.filter((item) => item.category === 'pay-as-you-go');
};

export const getEsignCreditPackageByIdFromCatalog = async (
  catalogPackageId: string,
): Promise<EsignCreditPackage | undefined> => {
  const catalog = await getActiveNomiaCatalog({ enabledOnly: false });

  return catalog.find((item) => item.id === catalogPackageId);
};

const categoryLabel = (
  category: NomiaPricePlanCategory,
): 'Pay as you go' | 'Monthly' | 'Annually' => {
  if (category === 'PAYG') {
    return 'Pay as you go';
  }

  if (category === 'MONTHLY') {
    return 'Monthly';
  }

  return 'Annually';
};

export const getNomiaPricePlansUiCatalog = async ({
  useLive = isNomiaLivePaystackEnv(),
}: {
  useLive?: boolean;
} = {}): Promise<NomiaPricePlansUiCatalog> => {
  const rows = (await listNomiaPricePlans()).filter((row) => row.isEnabled);

  const toUi = (row: NomiaPricePlanRow): NomiaPricePlanUiItem => {
    const planCode = useLive ? row.paystackPlanCodeLive : row.paystackPlanCodeTest;

    return {
      catalogPackageId: row.id,
      name: row.name,
      credits: row.credits,
      amount: formatZarDisplayPrice(row.priceInCents),
      planCode,
      label: categoryLabel(row.category),
    };
  };

  return {
    'Pay-as-you-go / Top-up': rows.filter((row) => row.category === 'PAYG').map(toUi),
    Monthly: rows.filter((row) => row.category === 'MONTHLY').map(toUi),
    Annual: rows.filter((row) => row.category === 'ANNUAL').map(toUi),
  };
};

/**
 * Credits lookup by Paystack plan code (webhook grants).
 * Merges DB rows with seed fallbacks so historical codes still resolve.
 */
export const getNomiaPlanDocumentQuotas = async (): Promise<Record<string, number>> => {
  const rows = await listNomiaPricePlans();
  const quotas: Record<string, number> = {};

  for (const row of rows) {
    quotas[row.paystackPlanCodeTest] = row.credits;
    quotas[row.paystackPlanCodeLive] = row.credits;
  }

  return quotas;
};

export const getNomiaCreditsForPlanCode = async (
  planCode: string | null | undefined,
): Promise<number> => {
  if (!planCode) {
    return 0;
  }

  const quotas = await getNomiaPlanDocumentQuotas();

  return quotas[planCode] ?? 0;
};

export const getNomiaSubscriptionPlanDetailsFromCatalog = async (
  planCode: string | null | undefined,
): Promise<NomiaSubscriptionPlanDetails | null> => {
  if (!planCode) {
    return null;
  }

  const rows = await listNomiaPricePlans();
  const match = rows.find(
    (row) =>
      (row.category === 'MONTHLY' || row.category === 'ANNUAL') &&
      (row.paystackPlanCodeTest === planCode || row.paystackPlanCodeLive === planCode),
  );

  if (!match) {
    // Fall back to seed constants for historical/unknown codes.
    return getNomiaSubscriptionPlanDetails(planCode);
  }

  return {
    planCode,
    name: match.name,
    label: match.category === 'MONTHLY' ? 'Monthly' : 'Annually',
    credits: match.credits,
    priceInCents: match.priceInCents,
  };
};

export const findNomiaSubscriptionPlanForChargeFromCatalog = async ({
  planCode,
  credits,
  priceInCents,
}: {
  planCode?: string | null;
  credits?: number | null;
  priceInCents?: number | null;
}): Promise<NomiaSubscriptionPlanDetails | null> => {
  const byCode = await getNomiaSubscriptionPlanDetailsFromCatalog(planCode);

  if (byCode) {
    return byCode;
  }

  if (credits == null || priceInCents == null) {
    return null;
  }

  const rows = await listNomiaPricePlans();
  const match = rows.find(
    (row) =>
      (row.category === 'MONTHLY' || row.category === 'ANNUAL') &&
      row.credits === credits &&
      row.priceInCents === priceInCents,
  );

  if (!match) {
    return findNomiaSubscriptionPlanForCharge({
      planCode,
      credits,
      priceInCents,
    });
  }

  return {
    planCode: planCode ?? match.paystackPlanCodeLive,
    name: match.name,
    label: match.category === 'MONTHLY' ? 'Monthly' : 'Annually',
    credits: match.credits,
    priceInCents: match.priceInCents,
  };
};

export const findNomiaPriceInCentsForCredits = async (credits: number): Promise<number> => {
  const payg = await getActiveNomiaPaygPackages();
  const exact = payg.find((item) => item.credits === credits);

  if (exact) {
    return exact.priceInCents;
  }

  const sorted = [...payg].sort((a, b) => a.credits - b.credits);
  const larger = sorted.find((item) => item.credits >= credits);
  const basis = larger ?? sorted[sorted.length - 1];

  if (!basis) {
    return 0;
  }

  return Math.round((basis.priceInCents * credits) / basis.credits);
};
