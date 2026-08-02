import { listPaystackBanks } from '@documenso/lib/server-only/paystack';
import { resolvePaystackBankAccount } from '@documenso/lib/server-only/paystack';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  syncResellerSubaccountStatus,
  updateResellerBankDetails,
  updateResellerPayoutMode,
} from '@documenso/lib/server-only/reseller/update-reseller-payout';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZListPaystackBanksRequestSchema,
  ZListPaystackBanksResponseSchema,
  ZRefreshResellerSubaccountStatusRequestSchema,
  ZRefreshResellerSubaccountStatusResponseSchema,
  ZResolvePaystackBankAccountRequestSchema,
  ZResolvePaystackBankAccountResponseSchema,
  ZUpdateResellerBankDetailsRequestSchema,
  ZUpdateResellerBankDetailsResponseSchema,
  ZUpdateResellerPayoutModeRequestSchema,
  ZUpdateResellerPayoutModeResponseSchema,
} from './reseller-payout.types';

export const updateResellerPayoutModeRoute = authenticatedProcedure
  .input(ZUpdateResellerPayoutModeRequestSchema)
  .output(ZUpdateResellerPayoutModeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, payoutMode } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const profile = await updateResellerPayoutMode({
      organisationId,
      payoutMode,
    });

    return {
      success: true as const,
      payoutMode: profile.payoutMode,
    };
  });

export const updateResellerBankDetailsRoute = authenticatedProcedure
  .input(ZUpdateResellerBankDetailsRequestSchema)
  .output(ZUpdateResellerBankDetailsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const profile = await updateResellerBankDetails({
      organisationId,
      bankCode: data.bankCode,
      bankName: data.bankName,
      bankAccountNumber: data.bankAccountNumber,
      bankAccountName: data.bankAccountName,
      accountType: data.accountType,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      physicalAddress: data.physicalAddress,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      vatStatus: data.vatStatus,
      vatNumber: data.vatNumber,
    });

    return {
      success: true as const,
      subaccountStatus: profile.subaccountStatus,
      paystackSubaccountCode: profile.paystackSubaccountCode,
    };
  });

export const listPaystackBanksRoute = authenticatedProcedure
  .input(ZListPaystackBanksRequestSchema)
  .output(ZListPaystackBanksResponseSchema)
  .query(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const country = input.country ?? 'south africa';

    const banks = await listPaystackBanks({ country });

    return {
      banks: banks.map((bank) => ({
        name: bank.name,
        code: bank.code,
        currency: bank.currency,
        supportedTypes: bank.supportedTypes ?? [],
      })),
    };
  });

export const resolvePaystackBankAccountRoute = authenticatedProcedure
  .input(ZResolvePaystackBankAccountRequestSchema)
  .output(ZResolvePaystackBankAccountResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { accountNumber, bankCode, currency } = input;

    assertResellerFeatureAccess(ctx.user.email);

    const resolved = await resolvePaystackBankAccount({
      accountNumber,
      bankCode,
      currency,
    });

    return {
      accountNumber: resolved.account_number,
      accountName: resolved.account_name,
    };
  });

export const refreshResellerSubaccountStatusRoute = authenticatedProcedure
  .input(ZRefreshResellerSubaccountStatusRequestSchema)
  .output(ZRefreshResellerSubaccountStatusResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const profile = await syncResellerSubaccountStatus(organisationId);

    if (!profile) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Reseller profile not found',
      });
    }

    return {
      success: true as const,
      subaccountStatus: profile.subaccountStatus,
      paystackSubaccountCode: profile.paystackSubaccountCode,
    };
  });
