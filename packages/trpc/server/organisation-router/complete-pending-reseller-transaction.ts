import { completePendingResellerTransaction } from '@documenso/lib/server-only/reseller/complete-pending-reseller-transaction';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCompletePendingResellerTransactionRequestSchema,
  ZCompletePendingResellerTransactionResponseSchema,
} from './complete-pending-reseller-transaction.types';

export const completePendingResellerTransactionRoute = authenticatedProcedure
  .input(ZCompletePendingResellerTransactionRequestSchema)
  .output(ZCompletePendingResellerTransactionResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, transactionId } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const transaction = await completePendingResellerTransaction({
      organisationId,
      transactionId,
    });

    return {
      id: transaction.id,
      status: transaction.status,
      completedAt: transaction.completedAt,
    };
  });
