import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { OrganisationCreateDialog } from '~/components/dialogs/organisation-create-dialog';
import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { SettingsHeader } from '~/components/general/settings-header';
import { UserOrganisationsTable } from '~/components/tables/user-organisations-table';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();

  const { user, organisations } = useSession();
  const isUserAdmin = isAdmin(user);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const ownedOrganisationsCount = organisations.filter((org) => org.ownerUserId === user.id).length;
  const rawMax = user.maxOrganisationCount as number | string | undefined;
  const numMax = typeof rawMax === 'number' ? rawMax : Number(rawMax);
  const maxOrganisationCount =
    !Number.isNaN(numMax) && numMax >= 0 ? numMax : 1;

  // Check if user can create more organisations
  // If maxOrganisationCount is 0, it means unlimited (only for admins)
  const canCreateOrganisation =
    (maxOrganisationCount === 0 && isUserAdmin) ||
    (maxOrganisationCount > 0 && ownedOrganisationsCount < maxOrganisationCount);

  const handleCreateOrganisationClick = () => {
    if (canCreateOrganisation) {
      setCreateDialogOpen(true);
    } else {
      setContactModalOpen(true);
    }
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Organisations`)}
        subtitle={_(msg`Manage all organisations you are currently associated with.`)}
      >
        <Button type="button" onClick={handleCreateOrganisationClick} variant="secondary">
          <Trans>Create organisation</Trans>
        </Button>
      </SettingsHeader>

      <OrganisationCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Create More Organisations</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Please contact us at{' '}
                <a
                  href="mailto:help@nomiadocs.com"
                  className="text-primary underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  help@nomiadocs.com
                </a>{' '}
                to create more than {String(maxOrganisationCount)} organisation{maxOrganisationCount !== 1 ? 's' : ''}.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setContactModalOpen(false)}>
              <Trans>Close</Trans>
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.location.href = 'mailto:help@nomiadocs.com';
              }}
            >
              <Trans>Contact Us</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserOrganisationsTable />

      <div className="mt-8 space-y-8">
        <OrganisationInvitations />
      </div>
    </div>
  );
}
