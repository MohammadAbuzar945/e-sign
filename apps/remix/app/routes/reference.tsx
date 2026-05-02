import { useLoaderData } from 'react-router';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

import { BrandingLogo } from '~/components/general/branding-logo';
import { appMetaTags } from '~/utils/meta';

import type { LoaderFunctionArgs } from 'react-router';

export function meta() {
  return appMetaTags('API Reference');
}

function filterDeprecatedEndpoints(spec: Record<string, unknown>): Record<string, unknown> {
  const filteredSpec = { ...spec };

  if (filteredSpec.paths && typeof filteredSpec.paths === 'object') {
    const paths = filteredSpec.paths as Record<string, unknown>;
    const filteredPaths: Record<string, unknown> = {};

    for (const [path, pathItem] of Object.entries(paths)) {
      // Skip embedding paths entirely
      if (path.startsWith('/embedding')) {
        continue;
      }

      if (pathItem && typeof pathItem === 'object') {
        const pathItemObj = pathItem as Record<string, unknown>;
        const filteredPathItem: Record<string, unknown> = {};

        for (const [method, operation] of Object.entries(pathItemObj)) {
          // Keep non-operation properties (like parameters, servers, etc.)
          if (
            method === 'parameters' ||
            method === 'servers' ||
            method === 'summary' ||
            method === 'description' ||
            method === '$ref'
          ) {
            filteredPathItem[method] = operation;
            continue;
          }

          // Filter out deprecated operations and embedding operations
          if (operation && typeof operation === 'object') {
            const operationObj = operation as Record<string, unknown>;
            const isDeprecated = operationObj.deprecated === true;
            const tags = operationObj.tags as unknown;
            const hasEmbeddingTag =
              Array.isArray(tags) && tags.includes('Embedding');

            if (!isDeprecated && !hasEmbeddingTag) {
              filteredPathItem[method] = operation;
            }
          } else {
            filteredPathItem[method] = operation;
          }
        }

        // Only include the path if it has at least one operation left
        if (Object.keys(filteredPathItem).length > 0) {
          filteredPaths[path] = filteredPathItem;
        }
      } else {
        filteredPaths[path] = pathItem;
      }
    }

    filteredSpec.paths = filteredPaths;
  }

  // Remove Embedding tag from tags array if it exists
  if (filteredSpec.tags && Array.isArray(filteredSpec.tags)) {
    filteredSpec.tags = (filteredSpec.tags as unknown[]).filter(
      (tag) =>
        typeof tag === 'object' &&
        tag !== null &&
        'name' in tag &&
        (tag as { name: string }).name !== 'Embedding',
    );
  }

  return filteredSpec;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin;
  const apiSpecUrl = `${baseUrl}/nomia-api.json`;
  
  try {
    const response = await fetch(apiSpecUrl);
    
    if (!response.ok) {
      throw new Response('API specification not found', { status: 404 });
    }
    
    const apiSpec = (await response.json()) as Record<string, unknown>;
    const { patchOpenApiMultipartFileParts } = await import(
      '@documenso/trpc/server/open-api-multipart-file-patch'
    );
    patchOpenApiMultipartFileParts(apiSpec);
    const filteredSpec = filterDeprecatedEndpoints(apiSpec);
    
    return {
      apiSpec: filteredSpec,
      apiSpecUrl,
    };
  } catch (error) {
    throw new Response('Failed to load API specification', { status: 500 });
  }
}

export default function ReferencePage() {
  const { apiSpec, apiSpecUrl } = useLoaderData<typeof loader>();

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <BrandingLogo className="h-8 w-auto" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">API Reference</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Interactive API documentation for the Nomia API
              </p>
            </div>
          </div>
        </div>

        {/* Swagger UI */}
        <div className="flex-1 overflow-auto">
          <style>{`
            .swagger-ui .filter-container {
              display: block !important;
              padding: 10px 0 !important;
            }
            .swagger-ui .filter-container input {
              display: block !important;
              visibility: visible !important;
              width: 100% !important;
              padding: 8px !important;
              margin: 10px 0 !important;
            }
            .swagger-ui .topbar {
              display: none !important;
            }
          `}</style>
          <SwaggerUI
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spec={apiSpec as any}
            deepLinking={true}
            displayOperationId={true}
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={1}
            docExpansion="list"
            filter={false}
            showExtensions={false}
            showCommonExtensions={false}
            tryItOutEnabled={true}
            supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
            persistAuthorization={true}
          />
        </div>
      </div>
    </div>
  );
}