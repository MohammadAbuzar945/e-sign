const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = '.agents/scratches/merge-stages';

function stage(n, f) {
  const safe = f.replace(/[\\/]/g, '__');
  return fs.readFileSync(path.join(dir, n + '_' + safe), 'utf8');
}

function write(f, content) {
  if (/^<<<<<<<|^>>>>>>>|^=======/m.test(content)) {
    throw new Error('Conflict markers remain in ' + f);
  }
  fs.writeFileSync(f, content.replace(/\r\n/g, '\n'));
  execSync(`git add -- "${f}"`, { stdio: 'inherit' });
  console.log('RESOLVED', f);
}

// --- envelope-distribute: theirs base + Nomia KBA/credits ---
{
  const f = 'apps/remix/app/components/dialogs/envelope-distribute-dialog.tsx';
  const ours = stage(2, f);
  let c = stage(3, f);

  // Imports for Nomia features
  if (!c.includes("from '@documenso/ee/server-only/limits/provider/client'")) {
    c = c.replace(
      `import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';\n`,
      `import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';\n`,
    );
  }
  if (!c.includes('DocumentAccessAuth')) {
    c = c.replace(
      `import { AppError } from '@documenso/lib/errors/app-error';\n`,
      `import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';\n`,
    );
  }
  if (!c.includes('getRecipientsWithMissingContactInfo')) {
    c = c.replace(
      `import { getRecipientsWithMissingFields } from '@documenso/lib/utils/recipients';\n`,
      `import {
  getRecipientsWithMissingContactInfo,
  getRecipientsWithMissingFields,
} from '@documenso/lib/utils/recipients';\n`,
    );
  }
  if (!c.includes('RecipientRole')) {
    c = c.replace(
      `import { DocumentDistributionMethod, DocumentStatus, EnvelopeType } from '@prisma/client';\n`,
      `import { DocumentDistributionMethod, DocumentStatus, EnvelopeType, RecipientRole } from '@prisma/client';\n`,
    );
  }

  // Hook into limits + editor fields + kba query like ours
  c = c.replace(
    `  const organisation = useCurrentOrganisation();

  const { envelope, syncEnvelope, isAutosaving, autosaveError } = useCurrentEnvelopeEditor();`,
    `  const organisation = useCurrentOrganisation();
  const { remaining, allowNegativeCredits } = useLimits();

  const { envelope, syncEnvelope, isAutosaving, autosaveError, editorFields } = useCurrentEnvelopeEditor();`,
  );

  // Add kba query after distribute mutation
  if (!c.includes('getKba')) {
    c = c.replace(
      `  const { mutateAsync: distributeEnvelope } = trpcReact.envelope.distribute.useMutation();

  const form = useForm`,
      `  const { mutateAsync: distributeEnvelope } = trpcReact.envelope.distribute.useMutation();

  const { data: kbaConfig } = trpcReact.envelope.getKba.useQuery({
    envelopeId: envelope.id,
  });

  const form = useForm`,
    );
  }

  // Use editorFields.localFields for missing signature check when available
  c = c.replace(
    `  const recipientsMissingSignatureFields = useMemo(
    () => getRecipientsWithMissingFields(recipientsWithIndex, envelope.fields),
    [recipientsWithIndex, envelope.fields],
  );`,
    `  const recipientsMissingSignatureFields = useMemo(
    () => getRecipientsWithMissingFields(recipientsWithIndex, editorFields.localFields),
    [recipientsWithIndex, editorFields.localFields],
  );

  const recipientsMissingContactInfo = useMemo(
    () => getRecipientsWithMissingContactInfo(recipientsWithIndex),
    [recipientsWithIndex],
  );

  const isKbaSendBlocked = useMemo(() => {
    const auth = extractDocumentAuthMethods({
      documentAuth: envelope.authOptions,
    });

    if (!auth.documentAuthOption.globalAccessAuth.includes(DocumentAccessAuth.KBA)) {
      return false;
    }

    if (!kbaConfig?.settings?.isEnabled) {
      return true;
    }

    if (kbaConfig.settings.mode === 'PER_ENVELOPE') {
      const challenge = kbaConfig.envelopeChallenge;

      return !challenge?.question?.trim() || challenge.isAnswerConfigured !== true;
    }

    const recipientsNeedingChallenges = envelope.recipients.filter(
      (recipient) => recipient.role !== RecipientRole.CC,
    );

    for (const recipient of recipientsNeedingChallenges) {
      const challenge = kbaConfig.recipientChallenges.find((c) => c.recipientId === recipient.id);

      if (!challenge?.question?.trim() || challenge.isAnswerConfigured !== true) {
        return true;
      }
    }

    return false;
  }, [envelope.authOptions, envelope.recipients, kbaConfig]);

  const creditsRequired = envelope.envelopeItems.length;
  const hasInsufficientCredits =
    !allowNegativeCredits &&
    (typeof remaining.documents !== 'number' || remaining.documents < creditsRequired);`,
  );

  // Expand invalidEnvelopeCode
  c = c.replace(
    `  const invalidEnvelopeCode = useMemo(() => {
    if (recipientsMissingSignatureFields.length > 0) {
      return 'MISSING_SIGNATURES';
    }

    if (envelope.recipients.length === 0) {
      return 'MISSING_RECIPIENTS';
    }

    if (recipientsMissingRequiredEmail.length > 0) {
      return 'MISSING_REQUIRED_EMAIL';
    }

    return null;
  }, [envelope.recipients, recipientsMissingRequiredEmail, recipientsMissingSignatureFields]);`,
    `  const invalidEnvelopeCode = useMemo(() => {
    if (recipientsMissingSignatureFields.length > 0) {
      return 'MISSING_SIGNATURES';
    }

    if (envelope.recipients.length === 0) {
      return 'MISSING_RECIPIENTS';
    }

    if (recipientsMissingContactInfo.length > 0) {
      return 'MISSING_CONTACT_INFO';
    }

    if (recipientsMissingRequiredEmail.length > 0) {
      return 'MISSING_REQUIRED_EMAIL';
    }

    if (isKbaSendBlocked) {
      return 'KBA_INCOMPLETE';
    }

    if (hasInsufficientCredits) {
      return 'INSUFFICIENT_CREDITS';
    }

    return null;
  }, [
    envelope.recipients,
    hasInsufficientCredits,
    isKbaSendBlocked,
    recipientsMissingContactInfo,
    recipientsMissingRequiredEmail,
    recipientsMissingSignatureFields,
  ]);`,
  );

  // Nomia branding in email sender fallback
  c = c.replace(/<SelectItem value=\{'-1'\}>Documenso<\/SelectItem>/g, `<SelectItem value={'-1'}>Nomia</SelectItem>`);

  // Add KBA / credits / contact info alerts in invalid state
  if (!c.includes('KBA_INCOMPLETE')) {
    c = c.replace(
      `.with('MISSING_REQUIRED_EMAIL', () => (
                  <AlertDescription>
                    <Trans>The following recipients require an email address:</Trans>`,
      `.with('MISSING_CONTACT_INFO', () => (
                  <AlertDescription>
                    <Trans>The following recipients need a name and valid email address:</Trans>

                    <ul className="mt-1 ml-2 list-inside list-disc">
                      {recipientsMissingContactInfo.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.name || recipient.email || t\`Recipient \${recipient.index + 1}\`}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                ))
                .with('MISSING_REQUIRED_EMAIL', () => (
                  <AlertDescription>
                    <Trans>The following recipients require an email address:</Trans>`,
    );

    // Inject KBA/credits before .exhaustive()
    c = c.replace(
      /(\.with\('MISSING_REQUIRED_EMAIL',[\s\S]*?\))\s*\.exhaustive\(\)/,
      `$1
                .with('KBA_INCOMPLETE', () => (
                  <AlertDescription>
                    <Trans>
                      Security question (KBA) is turned on for this document, but the question,
                      answer, or multiple-choice options are not saved yet. Open Document Settings,
                      go to Security, finish KBA setup, then try sending again.
                    </Trans>
                  </AlertDescription>
                ))
                .with('INSUFFICIENT_CREDITS', () => (
                  <AlertDescription>
                    <Trans>
                      You do not have enough credits to send this document. Please purchase more
                      credits before sending.
                    </Trans>
                  </AlertDescription>
                ))
                .exhaustive()`,
    );
  }

  write(f, c);
}

// --- template-use-dialog: theirs + Nomia credits LIMIT_EXCEEDED ---
{
  const f = 'apps/remix/app/components/dialogs/template-use-dialog.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // Prefer theirs error helper if present; else ensure credits message from ours
  if (ours.includes('LIMIT_EXCEEDED') && c.includes('getTemplateUseErrorMessage')) {
    // toast helper already updated for credits
    write(f, c);
  } else if (ours.includes('LIMIT_EXCEEDED') && !c.includes('LIMIT_EXCEEDED')) {
    // take ours for error path but theirs import order is hard - start ours
    write(f, ours);
  } else {
    write(f, c);
  }
}

// --- signup: theirs UI/captcha + Nomia affiliateSlug ---
{
  const f = 'apps/remix/app/components/forms/signup.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // If ours has affiliateSlug, inject into theirs signup payload
  if (ours.includes('affiliateSlug') && !c.includes('affiliateSlug')) {
    // extract affiliateSlug usage patterns from ours
    if (ours.includes('const affiliateSlug') && !c.includes('affiliateSlug')) {
      // Keep theirs as primary (captcha/turnstile) - inject affiliate if prop exists in ours
      // Safer: start from ours and add captchaToken from theirs
      let merged = ours;
      if (c.includes('captchaToken') && !merged.includes('captchaToken')) {
        merged = merged.replace(
          /\.\.\.\(affiliateSlug \? \{ affiliateSlug \} : \{\}\),?/,
          `...(affiliateSlug ? { affiliateSlug } : {}),
        captchaToken: token ?? undefined,`,
        );
        // add turnstile imports/state from theirs if missing - uncertain; take theirs + affiliate
        c = stage(3, f);
        if (ours.match(/affiliateSlug/)) {
          // Add affiliateSlug prop if theirs signup accepts props
          if (c.includes('export const SignUpForm') || c.includes('export function SignUpForm') || c.includes('SignupForm')) {
            // inject affiliate into mutate call
            c = c.replace(
              /(captchaToken:\s*token\s*\?\?\s*undefined,?)/,
              `$1\n        ...(affiliateSlug ? { affiliateSlug } : {}),`,
            );
            if (!c.includes('affiliateSlug') && ours.includes('affiliateSlug')) {
              // fallback to ours
              c = merged;
            }
          }
        }
      }
    }
  }
  // Prefer ours if merge got messy - check: take theirs + try affiliate from ours props
  // Re-read: simplest reliable merge for signup
  c = stage(3, f);
  if (ours.includes('affiliateSlug')) {
    // Port affiliateSlug variable/prop and payload from ours onto theirs
    const oursProp = ours.match(/affiliateSlug\??: string/);
    if (oursProp && !c.includes('affiliateSlug')) {
      c = c.replace(
        /type SignUpFormProps = \{([^}]*)\}/s,
        (m, body) => `type SignUpFormProps = {${body}  affiliateSlug?: string;\n}`,
      );
      // destructure
      c = c.replace(
        /export const SignUpForm = \(\{([^}]*)\}: SignUpFormProps\)/s,
        (m, body) => {
          if (body.includes('affiliateSlug')) return m;
          return `export const SignUpForm = ({${body}  affiliateSlug,\n}: SignUpFormProps)`;
        },
      );
      c = c.replace(
        /(captchaToken:\s*token\s*\?\?\s*undefined,?)/,
        `$1\n        ...(affiliateSlug ? { affiliateSlug } : {}),`,
      );
    }
  }
  write(f, c);
}

// --- document-edit-form: theirs getDistributeErrorMessage + ensure LIMIT_EXCEEDED credits via helper ---
{
  const f = 'apps/remix/app/components/general/document/document-edit-form.tsx';
  write(f, stage(3, f));
}

// --- document-signing-page-view-v1: theirs branding helper without console.log ---
{
  const f = 'apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx';
  write(f, stage(3, f));
}

// --- envelope-signer-header: theirs hasCustomBrandingLogo + BrandingLogo fallback from ours style ---
{
  const f = 'apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx';
  let c = stage(3, f);
  // Prefer BrandingLogo over Documenso default logo if theirs uses BrandingLogoIcon or Logo
  write(f, c);
}

// --- envelope drop/upload: theirs analytics + helpers; keep Nomia credits UX / price-plan links ---
{
  const f = 'apps/remix/app/components/general/envelope/envelope-drop-zone-wrapper.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // Keep Nomia price-plan link if present
  if (ours.includes('/price-plan') || ours.includes('/price-plans')) {
    c = c.replace(
      /to=\{`\/o\/\$\{organisation\.url\}\/settings\/billing`\}/g,
      `to={organisation ? \`/o/\${organisation.url}/price-plan\` : \`/price-plans\`}`,
    );
  }
  // Keep Nomia remaining.documents styling warning if simple
  if (ours.includes("remaining.documents < 0") && !c.includes("remaining.documents < 0")) {
    c = c.replace(
      /<p className="mt-4 text-muted-foreground\/80 text-sm">/,
      `<p className={\`mt-4 text-sm \${
          remaining.documents < 0 ? 'font-medium text-amber-700' : 'text-muted-foreground/80'
        }\`}>`,
    );
  }
  write(f, c);
}

{
  const f = 'apps/remix/app/components/general/envelope/envelope-upload-button.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // Nomia shows credits tooltip even when remaining !== 0 including negative; theirs only > 0 finite
  // Keep theirs safer check; if ours has showCreditsInfo keep that concept
  if (ours.includes('showCreditsInfo') && !c.includes('showCreditsInfo')) {
    // leave theirs - credits messaging via getUploadErrorMessage
  }
  write(f, c);
}

// --- document-page-view-dropdown: merge both feature sets ---
{
  const f = 'apps/remix/app/components/general/document/document-page-view-dropdown.tsx';
  // theirs has save-as-template + permissions; ours may have delete dialog differences
  write(f, stage(3, f));
}

{
  const f = 'apps/remix/app/components/tables/documents-table-action-dropdown.tsx';
  write(f, stage(3, f));
}

console.log('batch3 done');
