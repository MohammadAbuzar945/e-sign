import { generateOpenApiDocument } from 'trpc-to-openapi';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { patchOpenApiMultipartFileParts } from './open-api-multipart-file-patch';
import { appRouter } from './router';

const openApiDescription =
  'Welcome to the Documenso v2 API.\n\nThis API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.\n\n' +
  'Knowledge-based authentication (KBA): include `"KBA"` in `globalAccessAuth` on envelope create/update, then configure challenges with `POST /envelope/kba/update` ' +
  '(`envelopeId`, `settings`, and `envelopeChallenge` or `recipientChallenges` depending on `settings.mode`). ' +
  'Use `GET /envelope/{envelopeId}/kba` to read KBA configuration when permitted.';

const generatedOpenApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Documenso v2 API',
  description: openApiDescription,
  version: '1.0.0',
  baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`,
  securitySchemes: {
    apiKey: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
    },
  },
});

patchOpenApiMultipartFileParts(generatedOpenApiDocument as unknown as Record<string, unknown>);

export const openApiDocument = {
  ...generatedOpenApiDocument,

  /**
   * Dirty way to pass through the security field.
   */
  security: [
    {
      apiKey: [],
    },
  ],
};
