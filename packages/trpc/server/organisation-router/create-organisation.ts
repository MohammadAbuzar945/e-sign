import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { prisma } from '@documenso/prisma';
import { OrganisationType, type Role } from '@prisma/client';

import { authenticatedProcedure } from '../trpc';
import { ZCreateOrganisationRequestSchema, ZCreateOrganisationResponseSchema } from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name } = input;

    ctx.logger.info({
      input: {
        name,
      },
    });

    // Get user's maxOrganisationCount limit
    const user = await prisma.user.findUnique({
      where: {
        id: ctx.user.id,
      },
      select: {
        maxOrganisationCount: true,
        roles: true,
      } as {
        maxOrganisationCount: boolean;
        roles: boolean;
      },
    });

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    // Only session users have roles, API token users don't have roles so they can't be admins
    const roles = ctx.session && 'roles' in ctx.user ? (ctx.user.roles as Role[]) : null;
    const isUserAdmin = roles ? isAdmin({ roles }) : false;

    // Check organisation count limit
    // If maxOrganisationCount is 0, it means unlimited (only for admins)
    // For non-admins, treat 0 as 1 (default limit)
    const maxOrganisationCount = (user as { maxOrganisationCount?: number }).maxOrganisationCount ?? 1;
    const effectiveLimit = !isUserAdmin && maxOrganisationCount === 0 ? 1 : maxOrganisationCount;

    // Skip limit check only if user is admin and maxOrganisationCount is 0 (unlimited)
    if (!(isUserAdmin && effectiveLimit === 0)) {
      const userOrganisations = await prisma.organisation.findMany({
        where: {
          ownerUserId: ctx.user.id,
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
        ownerUserId: ctx.user.id,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });
    if (existingWithSameName) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'An organisation with this name already exists.',
      });
    }

    await createOrganisation({
      userId: ctx.user.id,
      name: trimmedName,
      type: OrganisationType.ORGANISATION,
      claim: internalClaims[INTERNAL_CLAIM_ID.FREE],
    });

    return {
      paymentRequired: false,
    };
  });
