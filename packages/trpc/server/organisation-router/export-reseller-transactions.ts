import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import {
  calculateResellerNetAmountInCents,
  resolveResellerVatAmountInCents,
} from '@documenso/lib/utils/reseller-vat';
import { exportResellerTransactions } from '@documenso/lib/server-only/reseller/reseller-profile';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZExportResellerTransactionsRequestSchema,
  ZExportResellerTransactionsResponseSchema,
} from './export-reseller-transactions.types';

export const exportResellerTransactionsRoute = authenticatedProcedure
  .input(ZExportResellerTransactionsRequestSchema)
  .output(ZExportResellerTransactionsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, query, fromDate, toDate } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const result = await exportResellerTransactions({
      organisationId,
      query,
      fromDate,
      toDate,
    });

    return {
      resellerOrganisationName: result.resellerOrganisationName,
      resellerVatNumber: result.resellerVatNumber,
      resellerVatStatus: result.resellerVatStatus,
      truncated: result.truncated,
      count: result.count,
      data: result.data.map((transaction) => {
        const sellerVatStatus = transaction.sellerVatStatus ?? result.resellerVatStatus;
        const sellerVatNumber = transaction.sellerVatNumber ?? result.resellerVatNumber;
        const vatAmount = resolveResellerVatAmountInCents(
          transaction.grossAmount,
          transaction.vatAmount,
          sellerVatNumber,
          sellerVatStatus,
        );

        return {
          id: transaction.id,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt,
          credits: transaction.credits,
          grossAmount: transaction.grossAmount,
          vatAmount,
          netAmount: calculateResellerNetAmountInCents(transaction.grossAmount, vatAmount),
          currency: transaction.currency,
          status: transaction.status,
          purchaserName: transaction.purchaserName,
          purchaserEmail: transaction.purchaserEmail,
          purchaserOrganisationName: transaction.purchaserOrganisationName,
          paystackReference: transaction.paystackReference,
          sellerVatStatus,
          sellerVatNumber,
        };
      }),
    };
  });
