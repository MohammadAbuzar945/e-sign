import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  fetchResellerTermsTemplateVariables,
  getEditableTemplateVariables,
} from '@documenso/lib/server-only/nomia-docgen';
import { getResellerSiteSettings } from '@documenso/lib/server-only/site-settings/get-reseller-site-settings';
import {
  RESELLER_TERMS_PROVIDER,
  resolveResellerTermsProvider,
} from '@documenso/lib/server-only/site-settings/schemas/reseller';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationResellerTermsTemplateVariablesRequestSchema,
  ZGetOrganisationResellerTermsTemplateVariablesResponseSchema,
} from './get-reseller-terms-template-variables.types';

export const getOrganisationResellerTermsTemplateVariablesRoute = authenticatedProcedure
  .input(ZGetOrganisationResellerTermsTemplateVariablesRequestSchema)
  .output(ZGetOrganisationResellerTermsTemplateVariablesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const resellerSettings = await getResellerSiteSettings();
    const provider = resolveResellerTermsProvider(resellerSettings?.termsProvider);

    if (provider === RESELLER_TERMS_PROVIDER.INTERNAL) {
      return {
        provider,
        variables: [],
        editableVariables: [],
      };
    }

    if (!resellerSettings?.termsDocGenTemplateId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller DocGen template ID is not configured in Admin Site Settings.',
      });
    }

    if (!resellerSettings.termsDocGenOrganizationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller DocGen organization ID is not configured in Admin Site Settings.',
      });
    }

    if (!resellerSettings.docGenAuthToken) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Nomia DocGen auth token is not configured in Admin Site Settings.',
      });
    }

    const variables = await fetchResellerTermsTemplateVariables({
      organizationId: resellerSettings.termsDocGenOrganizationId,
      templateId: resellerSettings.termsDocGenTemplateId,
      credentials: {
        apiUrl: resellerSettings.docGenApiUrl,
        authToken: resellerSettings.docGenAuthToken,
      },
    });

    return {
      provider,
      variables,
      editableVariables: getEditableTemplateVariables(variables),
    };
  });
