import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { BellIcon, Loader2Icon } from 'lucide-react';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminOrganisationPendingInvitesPanelProps = {
  organisationId: string;
};

export const AdminOrganisationPendingInvitesPanel = ({
  organisationId,
}: AdminOrganisationPendingInvitesPanelProps) => {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const [remindingInviteId, setRemindingInviteId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isLoadingError,
    refetch,
  } = trpc.admin.organisationMemberInvite.getPending.useQuery({
    organisationId,
  });

  const { mutateAsync: sendReminders, isPending } =
    trpc.admin.organisationMemberInvite.sendReminders.useMutation();

  const invites = data?.invites ?? [];

  const onSendReminders = async (invitationIds?: string[]) => {
    setRemindingInviteId(invitationIds?.length === 1 ? invitationIds[0] : null);

    try {
      const { sentCount, failedCount } = await sendReminders({
        organisationId,
        invitationIds,
      });

      if (sentCount === 0 && failedCount === 0) {
        toast({
          title: _(msg`Nothing to send`),
          description: _(msg`There are no pending invitations to remind.`),
        });

        return;
      }

      toast({
        title: _(msg`Reminders sent`),
        description:
          failedCount > 0
            ? _(msg`Sent ${sentCount} reminders, ${failedCount} failed.`)
            : _(msg`Sent ${sentCount} reminders.`),
        variant: failedCount > 0 ? 'destructive' : undefined,
      });

      await refetch();
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Something went wrong`),
        description: error.userMessage ?? _(msg`Unable to send reminders. Please try again.`),
        variant: 'destructive',
      });
    } finally {
      setRemindingInviteId(null);
    }
  };

  return (
    <section className="border-border rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            <Trans>Pending invitations</Trans>
          </h3>

          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>
              Members who were invited but have not joined yet. Reminders are sent as automated
              system emails and do not reveal who triggered them.
            </Trans>
          </p>
        </div>

        <Button
          onClick={async () => onSendReminders()}
          disabled={isPending || invites.length === 0}
          loading={isPending && remindingInviteId === null}
        >
          <BellIcon className="mr-2 h-4 w-4" />
          <Trans>Send reminders to all</Trans>
        </Button>
      </div>

      <div className="mt-6">
        {isLoading && (
          <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            <Trans>Loading pending invitations...</Trans>
          </div>
        )}

        {isLoadingError && (
          <p className="text-destructive py-8 text-center text-sm">
            <Trans>Unable to load pending invitations.</Trans>
          </p>
        )}

        {!isLoading && !isLoadingError && invites.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            <Trans>There are no pending invitations for this organisation.</Trans>
          </p>
        )}

        {!isLoading && !isLoadingError && invites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Email</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Role</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Invited at</Trans>
                </TableHead>
                <TableHead className="text-right">
                  <Trans>Actions</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>{invite.organisationRole}</TableCell>
                  <TableCell>{i18n.date(invite.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => onSendReminders([invite.id])}
                      disabled={isPending}
                      loading={isPending && remindingInviteId === invite.id}
                    >
                      <Trans>Send reminder</Trans>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
};
