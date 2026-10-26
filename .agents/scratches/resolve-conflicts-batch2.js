const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = '.agents/scratches/merge-stages';

function stage(n, f) {
  const safe = f.replace(/[\\/]/g, '__');
  return fs.readFileSync(path.join(dir, n + '_' + safe), 'utf8');
}

function write(f, content) {
  if (content.includes('<<<<<<<') || content.includes('>>>>>>>') || content.includes('=======')) {
    throw new Error('Conflict markers remain in ' + f);
  }
  fs.writeFileSync(f, content.replace(/\r\n/g, '\n'));
  execSync(`git add -- "${f}"`, { stdio: 'inherit' });
  console.log('RESOLVED', f);
}

// Enhance toast helper for Nomia credits (LIMIT_EXCEEDED)
{
  const f = 'apps/remix/app/utils/toast-error-messages.ts';
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes("AppErrorCode.LIMIT_EXCEEDED") || !c.includes('enough credits')) {
    c = c.replace(
      `export const getDistributeErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with('RECIPIENT_LIMIT_EXCEEDED', () => RECIPIENT_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .otherwise(() => ({
      title: msg\`Something went wrong\`,
      description: msg\`An error occurred while distributing the document.\`,
    }));
};`,
      `export const getDistributeErrorMessage = (code: string): ToastMessageDescriptor => {
  return match(code)
    .with('RECIPIENT_LIMIT_EXCEEDED', () => RECIPIENT_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with(AppErrorCode.TOO_MANY_REQUESTS, () => FAIR_USE_LIMIT_EXCEEDED_ERROR_MESSAGE)
    .with(AppErrorCode.LIMIT_EXCEEDED, () => ({
      title: msg\`Something went wrong\`,
      description: msg\`You do not have enough credits to send this document. Please purchase more credits.\`,
    }))
    .otherwise(() => ({
      title: msg\`Something went wrong\`,
      description: msg\`An error occurred while distributing the document.\`,
    }));
};`,
    );
    // Also template use credits message if still plan-oriented
    c = c.replace(
      `.with(AppErrorCode.LIMIT_EXCEEDED, () => ({
      title: msg\`Error\`,
      description: msg\`You have reached your document limit for this plan. Please upgrade your plan.\`,
    }))`,
      `.with(AppErrorCode.LIMIT_EXCEEDED, () => ({
      title: msg\`Error\`,
      description: msg\`You do not have enough credits to create this document. Please purchase more credits.\`,
    }))`,
    );
    fs.writeFileSync(f, c.replace(/\r\n/g, '\n'));
    execSync(`git add -- "${f}"`, { stdio: 'inherit' });
    console.log('UPDATED', f);
  } else {
    console.log('SKIP toast helper (already has credits)');
  }
}

// --- internal-audit-log-table ---
{
  const f = 'apps/remix/app/components/tables/internal-audit-log-table.tsx';
  let c = stage(3, f);
  c = c.replace(
    `.with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => 'bg-red-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT, () => 'bg-orange-500')`,
    `.with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => 'bg-red-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED, () => 'bg-red-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT, () => 'bg-orange-500')`,
  );
  c = c.replace(
    `<div className="font-medium text-foreground text-sm print:text-[8pt]">
                      {formattedAction.description}
                    </div>`,
    `<div
                      className={cn('font-medium text-foreground text-sm print:text-[8pt]', {
                        'text-destructive': log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
                      })}
                    >
                      {formattedAction.description}
                    </div>`,
  );
  write(f, c);
}

// --- envelope-editor-header ---
{
  const f = 'apps/remix/app/components/general/envelope-editor/envelope-editor-header.tsx';
  let c = stage(3, f);
  if (!c.includes('organisation-credits-chip')) {
    c = c.replace(
      `import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';\n`,
      `import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';
import { OrganisationCreditsChip } from '~/components/general/organisation-credits-chip';\n`,
    );
  }
  c = c.replace(
    `<div className="flex shrink-0 items-center space-x-2">
          {allowAttachments &&`,
    `<div className="flex shrink-0 items-center space-x-2">
          <OrganisationCreditsChip className="inline-flex" />

          {allowAttachments &&`,
  );
  write(f, c);
}

// --- document-preferences-form ---
{
  const f = 'apps/remix/app/components/forms/document-preferences-form.tsx';
  let c = stage(2, f);
  c = c.replace(
    `import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';`,
    `import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaDateFormatSchema,
} from '@documenso/lib/types/document-meta';`,
  );
  c = c.replace(
    `documentDateFormat: ZDocumentMetaTimezoneSchema.nullable(),`,
    `documentDateFormat: ZDocumentMetaDateFormatSchema.nullable(),`,
  );
  c = c.replace(
    `      documentTimezone: settings.documentTimezone,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      documentDateFormat: settings.documentDateFormat as TDocumentMetaDateFormat | null,`,
    `      documentTimezone: settings.documentTimezone,
      documentDateFormat: (() => {
        const parsed = ZDocumentMetaDateFormatSchema.safeParse(settings.documentDateFormat);
        return parsed.success ? parsed.data : null;
      })(),`,
  );
  if (!c.includes("from './form-sticky-save-bar'")) {
    c = c.replace(
      `import { DefaultRecipientsMultiSelectCombobox } from '../general/default-recipients-multiselect-combobox';\n`,
      `import { DefaultRecipientsMultiSelectCombobox } from '../general/default-recipients-multiselect-combobox';

import { FormStickySaveBar } from './form-sticky-save-bar';\n`,
    );
  }
  c = c.replace(
    `          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Update</Trans>
            </Button>
          </div>`,
    `          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />`,
  );
  write(f, c);
}

// --- organisation-update-form: ours (vatNumber) + FormStickySaveBar ---
{
  const f = 'apps/remix/app/components/forms/organisation-update-form.tsx';
  let c = stage(2, f);
  if (!c.includes("from './form-sticky-save-bar'")) {
    c = c.replace(
      /^((?:import .+\r?\n)+)/m,
      (m) => m + `import { FormStickySaveBar } from './form-sticky-save-bar';\n`,
    );
  }
  c = c.replace(
    /\n\s*<div className="flex flex-row[^"]*justify-end[\s\S]*?<AnimatePresence[\s\S]*?<\/AnimatePresence>[\s\S]*?<Button[\s\S]*?type="submit"[\s\S]*?<\/Button>\s*<\/div>/,
    `\n          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />`,
  );
  write(f, c);
}

// --- team-update-form: ours (isPrivate) + FormStickySaveBar ---
{
  const f = 'apps/remix/app/components/forms/team-update-form.tsx';
  let c = stage(2, f);
  if (!c.includes("from './form-sticky-save-bar'")) {
    c = c.replace(
      /^((?:import .+\r?\n)+)/m,
      (m) => m + `import { FormStickySaveBar } from './form-sticky-save-bar';\n`,
    );
  }
  c = c.replace(
    /\n\s*<div className="flex flex-row[^"]*justify-end[\s\S]*?<AnimatePresence[\s\S]*?<\/AnimatePresence>[\s\S]*?<Button[\s\S]*?type="submit"[\s\S]*?<\/Button>\s*<\/div>/,
    `\n          <FormStickySaveBar
            isDirty={form.formState.isDirty}
            isSubmitting={form.formState.isSubmitting}
            onReset={() => form.reset()}
          />`,
  );
  write(f, c);
}

// --- document logs / recent activity: keep Nomia EMAIL_FAILED styling + theirs import order ---
{
  const f = 'apps/remix/app/components/tables/admin-document-logs-table.tsx';
  let c = stage(3, f);
  // restore EMAIL_FAILED destructive styling from ours
  if (!c.includes('DOCUMENT_AUDIT_LOG_TYPE')) {
    c = c.replace(
      `import type { TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';`,
      `import { DOCUMENT_AUDIT_LOG_TYPE, type TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';`,
    );
    c = c.replace(
      `import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';`,
      `import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { cn } from '@documenso/ui/lib/utils';`,
    );
  }
  c = c.replace(
    `cell: ({ row }) => <span>{formatDocumentAuditLogAction(i18n, row.original).description}</span>,`,
    `cell: ({ row }) => (
          <span
            className={cn({
              'font-medium text-destructive': row.original.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
            })}
          >
            {formatDocumentAuditLogAction(i18n, row.original).description}
          </span>
        ),`,
  );
  write(f, c);
}

{
  const f = 'apps/remix/app/components/tables/document-logs-table.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // Prefer theirs structure but keep EMAIL_FAILED styling if ours had it
  if (ours.includes('EMAIL_FAILED') && !c.includes('EMAIL_FAILED')) {
    if (!c.includes('DOCUMENT_AUDIT_LOG_TYPE')) {
      c = c.replace(
        /import type \{ TDocumentAuditLog \} from '@documenso\/lib\/types\/document-audit-logs';/,
        `import { DOCUMENT_AUDIT_LOG_TYPE, type TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';`,
      );
    }
    if (!c.includes("from '@documenso/ui/lib/utils'")) {
      c = c.replace(
        /import \{([^}]+)\} from '@documenso\/ui\/primitives\/[^']+';/,
        (m) => `import { cn } from '@documenso/ui/lib/utils';\n` + m,
      );
    }
    c = c.replace(
      /cell: \(\{ row \}\) => <span>\{formatDocumentAuditLogAction\([^)]+\)\.description\}<\/span>,/,
      `cell: ({ row }) => (
          <span
            className={cn({
              'font-medium text-destructive': row.original.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
            })}
          >
            {formatDocumentAuditLogAction(i18n, row.original, userId).description}
          </span>
        ),`,
    );
  }
  write(f, c);
}

{
  const f = 'apps/remix/app/components/general/document/document-page-view-recent-activity.tsx';
  let c = stage(3, f);
  const ours = stage(2, f);
  // Restore EMAIL_FAILED icon + destructive text from ours onto theirs formatting
  if (ours.includes('EMAIL_FAILED') && !c.includes('EMAIL_FAILED')) {
    c = c.replace(
      `.otherwise(() => (
                      <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}`,
      `.with(DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED, () => (
                      <div className="rounded-full border border-red-300 bg-widget p-1 dark:border-red-600">
                        <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden="true" />
                      </div>
                    ))
                    .otherwise(() => (
                      <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}`,
    );
    // fix accidental } - the original ends with ))}
    c = c.replace(
      `.otherwise(() => (
                      <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}`,
      `.otherwise(() => (
                      <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}`,
    );
    // Actually ts-pattern uses ))} at end of match - check
    c = c.replace(
      `className="flex-auto truncate py-0.5 text-muted-foreground text-xs leading-5 dark:text-muted-foreground/70"`,
      `className={cn(
                    'flex-auto truncate py-0.5 text-muted-foreground text-xs leading-5 dark:text-muted-foreground/70',
                    {
                      'font-medium text-destructive dark:text-destructive':
                        auditLog.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
                    },
                  )}`,
    );
  }
  write(f, c);
}

console.log('batch2 done (except distribute/signup/etc)');
