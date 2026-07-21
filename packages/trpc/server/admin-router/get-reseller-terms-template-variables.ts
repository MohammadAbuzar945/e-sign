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
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZGetResellerTermsTemplateVariablesRequestSchema,
  ZGetResellerTermsTemplateVariablesResponseSchema,
} from './get-reseller-terms-template-variables.types';

export const getResellerTermsTemplateVariablesRoute = adminProcedure
  .input(ZGetResellerTermsTemplateVariablesRequestSchema)
  .output(ZGetResellerTermsTemplateVariablesResponseSchema)
  .query(async ({ ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

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
