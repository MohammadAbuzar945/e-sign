import { assertResellerDemoExtrasAccess } from '@documenso/lib/constants/demo-feature-flags';
import {
  getGlobalResellerBulkRateTiers,
  getResellerProfileBulkRateTiers,
} from '@documenso/lib/server-only/reseller/resolve-reseller-bulk-rate';
import {
  replaceGlobalResellerBulkRateTiers,
  replaceResellerProfileBulkRateTiers,
} from '@documenso/lib/server-only/reseller/manage-reseller-bulk-rates';
import { findResellerBulkPurchases } from '@documenso/lib/server-only/reseller/find-reseller-bulk-purchases';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZFindResellerBulkPurchasesRequestSchema,
  ZFindResellerBulkPurchasesResponseSchema,
  ZGetResellerBulkRatesRequestSchema,
  ZGetResellerBulkRatesResponseSchema,
  ZListGlobalResellerBulkRatesResponseSchema,
  ZReplaceGlobalResellerBulkRatesRequestSchema,
  ZReplaceGlobalResellerBulkRatesResponseSchema,
  ZReplaceResellerBulkRatesRequestSchema,
  ZReplaceResellerBulkRatesResponseSchema,
} from './reseller-bulk-rates.types';

export const listGlobalResellerBulkRatesRoute = adminProcedure
  .output(ZListGlobalResellerBulkRatesResponseSchema)
  .query(async ({ ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const tiers = await getGlobalResellerBulkRateTiers();

    return {
      tiers: tiers.map((tier) => ({
        id: tier.id,
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      })),
    };
  });

export const replaceGlobalResellerBulkRatesRoute = adminProcedure
  .input(ZReplaceGlobalResellerBulkRatesRequestSchema)
  .output(ZReplaceGlobalResellerBulkRatesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { tiers: inputTiers } = input;
    const tiers = await replaceGlobalResellerBulkRateTiers(inputTiers);

    return {
      tiers: tiers.map((tier) => ({
        id: tier.id,
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      })),
    };
  });

export const getResellerBulkRatesRoute = adminProcedure
  .input(ZGetResellerBulkRatesRequestSchema)
  .output(ZGetResellerBulkRatesResponseSchema)
  .query(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { resellerProfileId } = input;

    const [profile, tiers] = await Promise.all([
      prisma.resellerProfile.findUniqueOrThrow({
        where: { id: resellerProfileId },
        select: { bulkRatesUseCustom: true },
      }),
      getResellerProfileBulkRateTiers(resellerProfileId),
    ]);

    return {
      bulkRatesUseCustom: profile.bulkRatesUseCustom,
      tiers: tiers.map((tier) => ({
        id: tier.id,
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      })),
    };
  });

export const replaceResellerBulkRatesRoute = adminProcedure
  .input(ZReplaceResellerBulkRatesRequestSchema)
  .output(ZReplaceResellerBulkRatesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { resellerProfileId, bulkRatesUseCustom, tiers: inputTiers } = input;

    const result = await replaceResellerProfileBulkRateTiers({
      resellerProfileId,
      bulkRatesUseCustom,
      tiers: inputTiers,
    });

    return {
      bulkRatesUseCustom: result.bulkRatesUseCustom,
      tiers: result.tiers.map((tier) => ({
        id: tier.id,
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      })),
    };
  });

export const findResellerBulkPurchasesRoute = adminProcedure
  .input(ZFindResellerBulkPurchasesRequestSchema)
  .output(ZFindResellerBulkPurchasesResponseSchema)
  .query(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { query, page, perPage, status } = input;

    return await findResellerBulkPurchases({
      query,
      page,
      perPage,
      status,
    });
  });
