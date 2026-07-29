import {
  listNomiaPricePlans,
  updateNomiaPricePlans,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';

import { adminProcedure } from '../trpc';
import {
  getNomiaPricePlansMeta,
  ZGetNomiaPricePlansRequestSchema,
  ZGetNomiaPricePlansResponseSchema,
  updateNomiaPricePlansMeta,
  ZUpdateNomiaPricePlansRequestSchema,
  ZUpdateNomiaPricePlansResponseSchema,
} from './nomia-pricing.types';

export const getNomiaPricePlansRoute = adminProcedure
  .meta(getNomiaPricePlansMeta)
  .input(ZGetNomiaPricePlansRequestSchema)
  .output(ZGetNomiaPricePlansResponseSchema)
  .query(async () => {
    const plans = await listNomiaPricePlans();

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        category: plan.category,
        name: plan.name,
        credits: plan.credits,
        priceInCents: plan.priceInCents,
        currency: plan.currency,
        paystackPlanCodeTest: plan.paystackPlanCodeTest,
        paystackPlanCodeLive: plan.paystackPlanCodeLive,
        isEnabled: plan.isEnabled,
        sortOrder: plan.sortOrder,
      })),
    };
  });

export const updateNomiaPricePlansRoute = adminProcedure
  .meta(updateNomiaPricePlansMeta)
  .input(ZUpdateNomiaPricePlansRequestSchema)
  .output(ZUpdateNomiaPricePlansResponseSchema)
  .mutation(async ({ input }) => {
    const { plans: inputPlans } = input;

    const plans = await updateNomiaPricePlans(inputPlans);

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        category: plan.category,
        name: plan.name,
        credits: plan.credits,
        priceInCents: plan.priceInCents,
        currency: plan.currency,
        paystackPlanCodeTest: plan.paystackPlanCodeTest,
        paystackPlanCodeLive: plan.paystackPlanCodeLive,
        isEnabled: plan.isEnabled,
        sortOrder: plan.sortOrder,
      })),
    };
  });
