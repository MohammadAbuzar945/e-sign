/**
 * This is the main entry point for the server which will launch the RR7 application
 * and spin up auth, api, etc.
 *
 * Note:
 *  This file will be copied to the build folder during build time.
 *  Running this file will not work without a build.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

import server from './hono/server/router.js';
import * as build from './index.js';

// Missing hashed assets must not fall through to the HTML app. Cloudflare was
// caching those HTML 404s for Browser Cache TTL (often 4h), so clients kept
// failing route-module imports after a deploy race until purge/expiry.
server.use('/assets/*', async (c, next) => {
  const assetPath = join('build/client', c.req.path);

  if (!existsSync(assetPath)) {
    return c.body('Not Found', 404, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    });
  }

  return next();
});

server.use(
  serveStatic({
    root: 'build/client',
    onFound: (path, c) => {
      if (path.startsWith('build/client/assets')) {
        // Hard cache assets with hashed file names.
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        // Cache with revalidation for rest of static files.
        c.header('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400');
      }
    },
  }),
);

const handler = handle(build, server);

const port = parseInt(process.env.PORT || '3000', 10);

serve({ fetch: handler.fetch, port });
