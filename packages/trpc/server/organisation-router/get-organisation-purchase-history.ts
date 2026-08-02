import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { canAccessInvoiceHistory } from '@documenso/lib/constants/demo-feature-flags';
import { getOrganisationPurchaseHistory } from '@documenso/lib/server-only/billing/get-organisation-purchase-history';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationPurchaseHistoryRequestSchema,
  ZGetOrganisationPurchaseHistoryResponseSchema,
} from './get-organisation-purchase-history.types';

export const getOrganisationPurchaseHistoryRoute = authenticatedProcedure
  .input(ZGetOrganisationPurchaseHistoryRequestSchema)
  .output(ZGetOrganisationPurchaseHistoryResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    if (!canAccessInvoiceHistory(ctx.user.email)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Invoice history is not available for this account',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    if (organisation.ownerUserId !== ctx.user.id) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Only organisation owners can view purchase history',
      });
    }

    return getOrganisationPurchaseHistory({ organisationId: organisation.id });
  });
