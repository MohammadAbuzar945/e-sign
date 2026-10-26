const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = '.agents/scratches/merge-stages';

function stage(n, f) {
  const safe = f.replace(/[\\/]/g, '__');
  return fs.readFileSync(path.join(dir, n + '_' + safe), 'utf8');
}

function write(f, content) {
  fs.writeFileSync(f, content);
  execSync(`git add -- "${f}"`, { stdio: 'inherit' });
  console.log('RESOLVED', f);
}

const TAKE_THEIRS = [
  'apps/remix/app/components/dialogs/envelopes-bulk-delete-dialog.tsx',
  'apps/remix/app/components/dialogs/organisation-group-create-dialog.tsx',
  'apps/remix/app/components/dialogs/team-member-create-dialog.tsx',
  'apps/remix/app/components/general/document-signing/document-signing-complete-dialog.tsx',
  'apps/remix/app/components/forms/signin.tsx',
  'apps/remix/app/components/general/envelope-editor/envelope-editor.tsx',
  'apps/remix/app/components/general/envelope-editor/envelope-editor-fields-page-renderer.tsx',
  'apps/remix/app/components/general/envelope-editor/envelope-editor-fields-page.tsx',
  'apps/remix/app/components/general/envelope-editor/envelope-editor-recipient-form.tsx',
  'apps/remix/app/components/general/envelope-editor/envelope-editor-upload-page.tsx',
  'apps/remix/app/components/tables/envelopes-table-bulk-action-bar.tsx',
];

const TAKE_OURS = [
  'apps/remix/app/components/dialogs/organisation-create-dialog.tsx',
  'apps/remix/app/components/general/app-nav-mobile.tsx',
  'apps/remix/app/components/general/settings-header.tsx',
  'apps/remix/app/components/tables/user-organisations-table.tsx',
  'apps/remix/app/components/tables/team-members-table.tsx',
];

for (const f of TAKE_THEIRS) {
  write(f, stage(3, f));
}
for (const f of TAKE_OURS) {
  write(f, stage(2, f));
}

{
  const f = 'apps/remix/app/components/embed/embed-document-completed.tsx';
  const c = stage(3, f).replace("name || 'Documenso'", "name || 'Nomia'");
  write(f, c);
}

console.log('batch1 done');
