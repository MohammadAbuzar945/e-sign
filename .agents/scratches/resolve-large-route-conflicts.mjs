import { execSync } from 'node:child_process';
import fs from 'node:fs';

const show = (stage, path) =>
  execSync(`git show :${stage}:${path}`, { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

const write = (path, content) => {
  fs.writeFileSync(path, content.replace(/\r\n/g, '\n'));
  console.log('wrote', path, 'len', content.length);
};

// ---------- legacy editor: theirs version guard + ours folder-aware back link ----------
{
  let t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx');

  if (!t.includes('documentsListPath')) {
    t = t.replace(
      `  if (document.internalVersion !== 1) {
    throw redirect(\`\${documentRootPath}/\${document.envelopeId}/edit\`);
  }

  const documentVisibility = document.visibility;`,
      `  if (document.internalVersion !== 1) {
    throw redirect(\`\${documentRootPath}/\${document.envelopeId}/edit\`);
  }

  const documentsListPath = formatDocumentsPath(team.url, document.folderId);

  const documentVisibility = document.visibility;`,
    );

    t = t.replace(
      'documentRootPath,\n  });',
      'documentRootPath,\n    documentsListPath,\n  });',
    );

    t = t.replace(
      'const { document, documentRootPath } = useSuperLoaderData<typeof loader>();',
      'const { document, documentRootPath, documentsListPath } = useSuperLoaderData<typeof loader>();',
    );

    t = t.replace(
      '<Link to={documentRootPath} className="flex items-center text-documenso-700 hover:opacity-80">',
      '<Link to={documentsListPath} className="flex items-center text-documenso-700 hover:opacity-80">',
    );
  }

  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents.$id.legacy_editor.tsx', t);
}

// ---------- documents._index: theirs bulk ops + Nomia private-team owner gate + keep resend if present ----------
{
  const o = show(2, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents._index.tsx');
  let t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents._index.tsx');

  // Extract isOwnerNonMember block from ours
  const ownerGateMatch = o.match(
    /const isOrganisationOwner = organisation\.ownerUserId === user\.id;\s*const isOwnerNonMember = isOrganisationOwner && !team\.isTeamMember;[\s\S]*?if \(isOwnerNonMember\) \{[\s\S]*?\n  \}\n/,
  );

  if (ownerGateMatch && !t.includes('isOwnerNonMember')) {
    // Ensure imports for Bird, EnvelopeType, Trans, organisation, session
    if (!t.includes("from 'lucide-react'") || !t.includes('Bird')) {
      if (t.includes("from 'lucide-react'")) {
        t = t.replace(/import \{([^}]+)\} from 'lucide-react';/, (m, inner) => {
          if (inner.includes('Bird')) return m;
          return `import {${inner}, Bird } from 'lucide-react';`;
        });
      } else {
        t = t.replace(
          "import { useMemo, useState } from 'react';",
          "import { useMemo, useState } from 'react';\nimport { Bird } from 'lucide-react';",
        );
      }
    }

    if (!t.includes('useCurrentOrganisation')) {
      t = t.replace(
        "import { useSessionStorage }",
        "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';\nimport { useSession } from '@documenso/lib/client-only/providers/session';\nimport { useSessionStorage }",
      );
    } else if (!t.includes('useSession')) {
      t = t.replace(
        "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';",
        "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';\nimport { useSession } from '@documenso/lib/client-only/providers/session';",
      );
    }

    if (!t.includes('EnvelopeType')) {
      t = t.replace(
        /import \{([^}]+)\} from '@prisma\/client';/,
        (m, inner) => (inner.includes('EnvelopeType') ? m : `import {${inner}, EnvelopeType } from '@prisma/client';`),
      );
    }

    // Insert hooks after team hook usage - find `const team = useCurrentTeam()`
    if (!t.includes('const organisation = useCurrentOrganisation()')) {
      t = t.replace(
        /const team = useCurrentTeam\(\);/,
        `const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();
  const { user } = useSession();`,
      );
    }

    // Insert gate before main return - look for `return (` after data loading that starts EnvelopeDropZoneWrapper type DOCUMENT
    // Find first `return (\n    <EnvelopeDropZoneWrapper` that is the main page
    const gate = ownerGateMatch[0];
    const insertPoint = t.indexOf('return (\n    <EnvelopeDropZoneWrapper type={EnvelopeType.DOCUMENT}>');
    if (insertPoint === -1) {
      // try alternate
      const alt = t.search(/return \(\s*\n\s*<EnvelopeDropZoneWrapper/);
      if (alt !== -1) {
        t = t.slice(0, alt) + gate + '\n  ' + t.slice(alt);
      } else {
        console.warn('documents._index: could not find insert point for owner gate');
      }
    } else {
      t = t.slice(0, insertPoint) + gate + '\n  ' + t.slice(insertPoint);
    }
  }

  // Optionally keep bulk resend from ours if theirs lacks it
  if (o.includes('EnvelopesBulkResendDialog') && !t.includes('EnvelopesBulkResendDialog')) {
    console.log('note: bulk resend from Nomia not in main; leaving main cancel/download');
  }

  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/documents._index.tsx', t);
}

// ---------- templates._index: theirs + Nomia owner gate ----------
{
  const o = show(2, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates._index.tsx');
  let t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates._index.tsx');

  const ownerGateMatch = o.match(
    /const isOrganisationOwner = organisation\.ownerUserId === user\.id;\s*const isOwnerNonMember = isOrganisationOwner && !team\.isTeamMember;[\s\S]*?if \(isOwnerNonMember\) \{[\s\S]*?\n  \}\n/,
  );

  if (ownerGateMatch && !t.includes('isOwnerNonMember')) {
    if (!t.includes('Bird')) {
      if (t.includes("from 'lucide-react'")) {
        t = t.replace(/import \{([^}]+)\} from 'lucide-react';/, (m, inner) =>
          inner.includes('Bird') ? m : `import {${inner}, Bird } from 'lucide-react';`,
        );
      }
    }
    if (!t.includes('useSession')) {
      t = t.replace(
        "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';",
        "import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';\nimport { useSession } from '@documenso/lib/client-only/providers/session';",
      );
    }
    if (!t.includes('const { user } = useSession()')) {
      t = t.replace(
        /const organisation = useCurrentOrganisation\(\);/,
        `const organisation = useCurrentOrganisation();
  const { user } = useSession();`,
      );
    }

    const gate = ownerGateMatch[0];
    const insertPoint = t.search(/return \(\s*\n\s*<EnvelopeDropZoneWrapper type=\{EnvelopeType\.TEMPLATE\}/);
    if (insertPoint !== -1) {
      t = t.slice(0, insertPoint) + gate + '\n  ' + t.slice(insertPoint);
    } else {
      console.warn('templates._index: could not find insert point for owner gate');
    }
  }

  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates._index.tsx', t);
}

// ---------- templates.$id._index: theirs + folder-aware back link from ours ----------
{
  const o = show(2, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates.$id._index.tsx');
  let t = show(3, 'apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates.$id._index.tsx');

  if (o.includes('templatesListPath') && !t.includes('templatesListPath')) {
    // add formatTemplatesPath usage if needed
    if (!t.includes('formatTemplatesPath')) {
      t = t.replace(
        /import \{([^}]+)\} from '@documenso\/lib\/utils\/teams';/,
        (m, inner) =>
          inner.includes('formatTemplatesPath')
            ? m
            : `import {${inner}, formatTemplatesPath } from '@documenso/lib/utils/teams';`,
      );
    }

    // After envelope loaded, define templatesListPath
    if (t.includes('const isOwnTeamTemplate')) {
      t = t.replace(
        'const isOwnTeamTemplate = envelope.teamId === team?.id;',
        `const isOwnTeamTemplate = envelope.teamId === team?.id;
  const templatesListPath = formatTemplatesPath(team.url, envelope.folderId);`,
      );
    }

    // Prefer folder-aware link but keep theirs wrapper if present
    t = t.replace(
      /to=\{templateRootPath\} className="flex items-center text-documenso-700 hover:opacity-80"/,
      'to={templatesListPath} className="flex items-center text-documenso-700 hover:opacity-80"',
    );
  }

  write('apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates.$id._index.tsx', t);
}

// ---------- sign.$token: theirs features + Nomia KBA + Nomia branding links ----------
{
  const o = show(2, 'apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx');
  let t = show(3, 'apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx');

  // Ensure KBA import
  if (!t.includes('DocumentSigningKbaAccessGate')) {
    const kbaImport = o.match(/import .*DocumentSigningKbaAccessGate.*/);
    if (kbaImport) {
      t = t.replace(
        /import \{ DocumentSigningAuthProvider \}.*/,
        (m) => `${m}\n${kbaImport[0]}`,
      );
      if (!t.includes('DocumentSigningKbaAccessGate')) {
        // try alternate import style from ours
        const block = o.split('\n').filter((l) => l.includes('DocumentSigningKbaAccessGate'));
        for (const line of block) {
          if (line.startsWith('import') && !t.includes(line)) {
            t = t.replace(
              "import { DocumentSigningAuthProvider }",
              `${line}\nimport { DocumentSigningAuthProvider }`,
            );
          }
        }
      }
    }

    // Find import path from ours file content
    const importLine = o
      .split('\n')
      .find((l) => l.includes('DocumentSigningKbaAccessGate') && l.startsWith('import'));
    if (importLine && !t.includes('DocumentSigningKbaAccessGate')) {
      t = `import { DocumentSigningKbaAccessGate } from '~/components/general/document-signing/document-signing-kba-access-gate';\n` + t;
    }
  }

  // Ensure env import for Nomia links
  if (!t.includes("from '@documenso/lib/utils/env'") && o.includes("from '@documenso/lib/utils/env'")) {
    t = t.replace(
      "import { isRecipientExpired }",
      "import { env } from '@documenso/lib/utils/env';\nimport { isRecipientExpired }",
    );
    if (!t.includes("from '@documenso/lib/utils/env'")) {
      t = `import { env } from '@documenso/lib/utils/env';\n` + t;
    }
  }

  // Replace Documenso marketing links with Nomia
  t = t.replace(
    /<Link to="https:\/\/documenso\.com" className="text-documenso-700 hover:text-documenso-600">\s*Check out Documenso/g,
    `<Link
                  to={env('NEXT_PUBLIC_WEBAPP_URL') ?? '/'}
                  className="text-documenso-700 hover:text-documenso-600"
                >
                  Check out Nomia`,
  );

  // Wrap v1 signing view with KBA gate
  if (!t.includes('<DocumentSigningKbaAccessGate')) {
    t = t.replace(
      /(<DocumentSigningAuthProvider[^>]*>\s*)(\{sessionData\?\.user && <AuthenticatedHeader \/>\}[\s\S]*?<DocumentSigningPageViewV1[\s\S]*?\/>\s*<\/div>\s*)(<\/DocumentSigningAuthProvider>)/,
      `$1<DocumentSigningKbaAccessGate token={recipient.token}>
          <>
            $2
          </>
        </DocumentSigningKbaAccessGate>
      $3`,
    );

    // V2 wrap
    t = t.replace(
      /(<DocumentSigningAuthProvider documentAuthOptions=\{envelope\.authOptions\} recipient=\{recipient\} user=\{user\}>\s*)(<EnvelopeRenderProvider[\s\S]*?<\/EnvelopeRenderProvider>\s*)(<\/DocumentSigningAuthProvider>)/,
      `$1<DocumentSigningKbaAccessGate token={recipient.token}>
          $2
        </DocumentSigningKbaAccessGate>
      $3`,
    );
  }

  write('apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx', t);
}

console.log('large files done');
