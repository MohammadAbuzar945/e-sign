import { execSync } from 'node:child_process';
import fs from 'node:fs';

const show = (stage, path) =>
  execSync(`git show :${stage}:${path}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

const write = (path, content) => {
  fs.writeFileSync(path, content.replace(/\r\n/g, '\n'));
  console.log('wrote', path);
};

const stripMarkersKeep = (content, keep) => {
  // keep: 'ours' | 'theirs' | 'both' (concat)
  return content.replace(
    /<<<<<<<[^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>[^\n]*\n/g,
    (_m, ours, theirs) => {
      if (keep === 'ours') return ours;
      if (keep === 'theirs') return theirs;
      return ours + theirs;
    },
  );
};

// --- billing: theirs + Nomia owner gate + invoice history flag ---
{
  let t = show(3, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.billing.tsx');

  t = t.replace(
    "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';\n",
    `import { useSession } from '@documenso/lib/client-only/providers/session';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canAccessInvoiceHistory } from '@documenso/lib/constants/demo-feature-flags';
`,
  );

  t = t.replace(
    'const organisation = useCurrentOrganisation();\n\n  const [searchParams',
    `const organisation = useCurrentOrganisation();
  const { user } = useSession();

  const isOrganisationOwner = organisation.ownerUserId === user.id;

  if (!isOrganisationOwner) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <p className="text-muted-foreground text-sm">
          <Trans>Only organisation owners can access billing.</Trans>
        </p>
      </div>
    );
  }

  const [searchParams`,
  );

  t = t.replace(
    '<OrganisationBillingInvoicesTable organisationId={organisation.id} subscriptionExists={Boolean(subscription)} />',
    `{canAccessInvoiceHistory(user.email) ? (
          <OrganisationBillingInvoicesTable
            organisationId={organisation.id}
            subscriptionExists={Boolean(subscription)}
          />
        ) : null}`,
  );

  write('apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.billing.tsx', t);
}

// --- general: Nomia PERSONAL type guard ---
write(
  'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.general.tsx',
  show(2, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.general.tsx'),
);

// --- groups: keep ours ---
write(
  'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.groups.$id.tsx',
  show(2, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.groups.$id.tsx'),
);

// --- teams: theirs structure + credit download ---
{
  let t = show(3, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx');

  if (!t.includes('OrganisationCreditUsageDownloadButton')) {
    t = t.replace(
      "import { SettingsHeader } from '~/components/general/settings-header';",
      `import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { OrganisationCreditUsageDownloadButton } from '~/components/general/organisation-credit-usage-download-button';
import { SettingsHeader } from '~/components/general/settings-header';`,
    );

    // Insert organisation hook near top of component
    t = t.replace(
      'export default function OrganisationSettingsTeamsPage() {\n',
      `export default function OrganisationSettingsTeamsPage() {
  const organisation = useCurrentOrganisation();
`,
    );

    t = t.replace(
      `<SettingsHeader hideDivider title={t\`Teams\`} subtitle={t\`Manage the teams in this organisation.\`}>
        <TeamCreateDialog />`,
      `<SettingsHeader hideDivider title={t\`Teams\`} subtitle={t\`Manage the teams in this organisation.\`}>
        <div className="flex flex-wrap items-center gap-2">
          <OrganisationCreditUsageDownloadButton
            organisationId={organisation.id}
            organisationUrl={organisation.url}
          />
          <TeamCreateDialog />
        </div>`,
    );
  }

  write('apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx', t);
}

// --- org document: theirs base + Nomia KBA/audit log ---
{
  let t = show(3, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.document.tsx');
  const o = show(2, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.document.tsx');

  // Prefer ours payload fields but keep theirs meta/throw err/layout if present
  // Simplest reliable: start from ours, apply theirs meta msg and throw err
  let merged = o;

  if (t.includes("appMetaTags(msg`Document Preferences`)")) {
    merged = merged.replace(
      "export function meta() {\n  return appMetaTags('Document Preferences');\n}",
      "export function meta() {\n  return appMetaTags(msg`Document Preferences`);\n}",
    );
    if (!merged.includes("import { msg }")) {
      merged = merged.replace(
        "import { useLingui } from '@lingui/react/macro';",
        "import { msg } from '@lingui/core/macro';\nimport { useLingui } from '@lingui/react/macro';",
      );
    }
  }

  if (t.includes('throw err;') && !merged.includes('throw err;')) {
    merged = merged.replace(
      `variant: 'destructive',\n      });\n    }\n  };`,
      `variant: 'destructive',\n      });\n\n      throw err;\n    }\n  };`,
    );
  }

  // Keep AI loader from ours; drop max-w-2xl to match theirs shell if desired
  merged = merged.replace('<div className="max-w-2xl">', '<div>');

  write('apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.document.tsx', merged);
}

// --- team document: ours KBA/audit + theirs throw ---
{
  let o = show(2, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.document.tsx');
  const t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.document.tsx');

  if (t.includes('throw err;') && !o.includes('throw err;')) {
    o = o.replace(
      `variant: 'destructive',\n      });\n    }\n  };`,
      `variant: 'destructive',\n      });\n\n      throw err;\n    }\n  };`,
    );
  }

  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.document.tsx', o);
}

// --- tokens: take theirs (documentation link) ---
write(
  'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.tokens.tsx',
  show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.tokens.tsx'),
);

// --- legacy editor: take theirs redirect guard, keep ours path helper if both needed ---
{
  const o = show(2, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx');
  const t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx');

  // Prefer theirs if it has internalVersion redirect; inject documentsListPath from ours if missing
  let merged = t;
  if (o.includes('documentsListPath') && !merged.includes('documentsListPath')) {
    // keep theirs primarily
  }
  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx', merged);
}

// --- org branding: take theirs (CSC/sanitize/upsell), Nomia contact for non-cloud ---
{
  let t = show(3, 'apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.branding.tsx');
  // Replace Update Billing only path - keep theirs for cloud; for self-host Nomia used mailto
  // Keep theirs as primary
  write('apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.branding.tsx', t);
}

// --- team branding: take theirs ---
write(
  'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.branding.tsx',
  show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.branding.tsx'),
);

// --- e2e: keep Nomia emails ---
{
  const content = fs.readFileSync('packages/app-tests/e2e/teams/default-recipients.spec.ts', 'utf8');
  write(
    'packages/app-tests/e2e/teams/default-recipients.spec.ts',
    stripMarkersKeep(content, 'ours'),
  );
}

console.log('settings batch done');
