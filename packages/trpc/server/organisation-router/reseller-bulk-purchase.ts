import { initializeResellerBulkPurchase } from '@documenso/lib/server-only/reseller/initialize-reseller-bulk-purchase';
import { getEffectiveResellerBulkRatesForOrganisation } from '@documenso/lib/server-only/reseller/resolve-reseller-bulk-rate';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetEffectiveResellerBulkRatesRequestSchema,
  ZGetEffectiveResellerBulkRatesResponseSchema,
  ZInitializeResellerBulkPurchaseRequestSchema,
  ZInitializeResellerBulkPurchaseResponseSchema,
} from './reseller-bulk-purchase.types';

export const getEffectiveResellerBulkRatesRoute = authenticatedProcedure
  .input(ZGetEffectiveResellerBulkRatesRequestSchema)
  .output(ZGetEffectiveResellerBulkRatesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    return getEffectiveResellerBulkRatesForOrganisation(organisationId);
  });

export const initializeResellerBulkPurchaseRoute = authenticatedProcedure
  .input(ZInitializeResellerBulkPurchaseRequestSchema)
  .output(ZInitializeResellerBulkPurchaseResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, credits } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    return initializeResellerBulkPurchase({
      organisationId,
      userId: ctx.user.id,
      purchaserEmail: ctx.user.email,
      credits,
    });
  });
