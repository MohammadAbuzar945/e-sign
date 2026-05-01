/**
 * One-off / CI helper: merge generated OpenAPI (e.g. from GET /api/v2/openapi.json)
 * with Nomia branding for apps/remix/public/nomia-api.json
 *
 * Usage:
 *   node scripts/merge-nomia-openapi.mjs <path-to-openapi.json>
 *
 * If no arg, reads apps/remix/public/nomia-api-temp.json (from curl localhost).
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputPath =
  process.argv[2] ?? join(root, 'apps/remix/public/nomia-api-temp.json');
const outPath = join(root, 'apps/remix/public/nomia-api.json');

const spec = JSON.parse(readFileSync(inputPath, 'utf8'));

const kbaHelp = `

## Knowledge-based authentication (KBA)

1. Include \`"KBA"\` in \`globalAccessAuth\` when creating or updating an envelope so signers must pass KBA before access.
2. Configure policy and challenges with \`POST /envelope/kba/update\`: pass \`envelopeId\`, \`settings\` (\`mode\`, \`isEnabled\`, \`maxAttempts\`, \`lockoutMinutes\`), and either \`envelopeChallenge\` (PER_ENVELOPE) or \`recipientChallenges\` with \`recipientId\` (PER_RECIPIENT).
3. Use \`GET /envelope/{envelopeId}/kba\` to read the current KBA configuration for an envelope (when permitted).
`;

spec.info = {
  title: 'Nomia Signature API',
  description:
    'Welcome to the Nomia API.\n\nThis API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.' +
    kbaHelp,
  version: '2.0.0',
};

spec.servers = [{ url: 'https://sign.nomiadocs.com/api/v2' }];

writeFileSync(outPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath} (${statSync(outPath).size} bytes)`);
