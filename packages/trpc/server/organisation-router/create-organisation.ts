import { OrganisationType, Role, SubscriptionStatus } from '@prisma/client';

import { createCheckoutSession } from '@documenso/ee/server-only/stripe/create-checkout-session';
import { createCustomer } from '@documenso/ee/server-only/stripe/create-customer';
import { IS_BILLING_ENABLED, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { getSubscriptionClaim } from '@documenso/lib/server-only/subscription/get-subscription-claim';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationRequestSchema,
  ZCreateOrganisationResponseSchema,
} from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name, priceId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        name,
      },
    });

    // Create the organisation with Stripe checkout if billing is enabled and a priceId is provided.
    if (IS_BILLING_ENABLED() && priceId) {
      const pendingOrganisation = await prisma.organisation.findFirst({
        where: {
          ownerUserId: user.id,
          type: OrganisationType.ORGANISATION,
          OR: [
            {
              subscription: {
                is: null,
              },
            },
            {
              subscription: {
                status: SubscriptionStatus.INACTIVE,
              },
            },
          ],
        },
      });

      if (pendingOrganisation) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message:
            'You have a pending organisation awaiting payment. Complete or remove it before creating a new one.',
        });
      }

      const freeSubscriptionClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

      const organisation = await createOrganisation({
        userId: user.id,
        name,
        type: OrganisationType.ORGANISATION,
        claim: freeSubscriptionClaim,
      });

      let customerId = organisation.customerId;

      if (!customerId) {
        const customer = await createCustomer({
          email: user.email,
          name: user.name || user.email,
        });

        customerId = customer.id;

        await prisma.organisation.update({
          where: {
            id: organisation.id,
          },
          data: {
            customerId,
          },
        });
      }

      const checkoutUrl = await createCheckoutSession({
        priceId,
        customerId,
        returnUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/o/${organisation.url}/settings/billing`,
      });

      return {
        paymentRequired: true,
        checkoutUrl,
      };
    }

    // Check organisation count limit for free organisations.
    // Only session users have roles, API token users don't have roles so they can't be admins
    const roles = ctx.session && 'roles' in ctx.user ? (ctx.user.roles as Role[]) : null;
    const isUserAdmin = roles ? isAdmin({ roles }) : false;

    // Get user's maxOrganisationCount limit
    const userRecord = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        maxOrganisationCount: true,
      } as {
        maxOrganisationCount: boolean;
      },
    });

    if (!userRecord) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    // If maxOrganisationCount is 0, it means unlimited (only for admins).
    // For non-admins, treat 0 as 1 (default limit).
    const maxOrganisationCount =
      (userRecord as { maxOrganisationCount?: number }).maxOrganisationCount ?? 1;
    const effectiveLimit = !isUserAdmin && maxOrganisationCount === 0 ? 1 : maxOrganisationCount;

    // Skip limit check only if user is admin and maxOrganisationCount is 0 (unlimited).
    if (!(isUserAdmin && effectiveLimit === 0)) {
      const userOrganisations = await prisma.organisation.findMany({
        where: {
          ownerUserId: user.id,
        },
      });

      if (userOrganisations.length >= effectiveLimit) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: `You have reached the maximum number of organisations (${effectiveLimit}).${!isUserAdmin ? ' Only administrators can create additional organisations.' : ''}`,
        });
      }
    }

    const trimmedName = name.trim();
    const existingWithSameName = await prisma.organisation.findFirst({
      where: {
        ownerUserId: user.id,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existingWithSameName) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'An organisation with this name already exists.',
      });
    }

    // Free organisations should be Personal by default when billing is enabled.
    const organisationType = IS_BILLING_ENABLED()
      ? OrganisationType.PERSONAL
      : OrganisationType.ORGANISATION;

    const freeSubscriptionClaim = await getSubscriptionClaim(INTERNAL_CLAIM_ID.FREE);

    await createOrganisation({
      userId: user.id,
      name: trimmedName,
      type: organisationType,
      claim: freeSubscriptionClaim,
    });

    return {
      paymentRequired: false,
    };
  });
