import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EyeIcon, MailIcon, SendIcon, UsersIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZResellerBroadcastContentSchema } from '@documenso/trpc/server/admin-router/notify-resellers.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@documenso/ui/primitives/alert-dialog';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZNotifyResellersFormSchema = ZResellerBroadcastContentSchema;

type TNotifyResellersFormSchema = z.infer<typeof ZNotifyResellersFormSchema>;

const EXAMPLE_HTML = `<p>We are writing to let you know about an upcoming update.</p>
<p><strong>What is changing</strong></p>
<ul>
  <li>Updated credit pricing takes effect on 1 August.</li>
  <li>Your existing affiliate links will continue to work as usual.</li>
</ul>
<p>If you have any questions, reply to this email and our team will assist you.</p>
<p>Kind regards,<br />The Team</p>`;

export const AdminResellerNotifyPanel = () => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRecipientsOpen, setIsRecipientsOpen] = useState(false);

  const form = useForm<TNotifyResellersFormSchema>({
    resolver: zodResolver(ZNotifyResellersFormSchema),
    defaultValues: {
      subject: '',
      htmlBody: '',
    },
  });

  const { data: recipientsData, isLoading: isRecipientsLoading } =
    trpc.admin.resellerApplications.getNotifyRecipients.useQuery();

  const { mutateAsync: previewNotify, isPending: isPreviewPending } =
    trpc.admin.resellerApplications.previewNotify.useMutation();

  const { mutateAsync: notifyResellers, isPending: isNotifyPending } =
    trpc.admin.resellerApplications.notify.useMutation();

  const recipientCount = recipientsData?.recipientCount ?? 0;
  const recipients = recipientsData?.recipients ?? [];
  const isBusy = isPreviewPending || isNotifyPending;

  const recipientSummary = useMemo(() => {
    if (recipients.length === 0) {
      return null;
    }

    const previewNames = recipients
      .slice(0, 5)
      .map((recipient) => recipient.organisationName)
      .join(', ');

    if (recipients.length <= 5) {
      return previewNames;
    }

    return `${previewNames}, +${recipients.length - 5} more`;
  }, [recipients]);

  const onPreview = async (values: TNotifyResellersFormSchema) => {
    try {
      const result = await previewNotify(values);

      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);

      toast({
        title: _(msg`Preview ready`),
        description: _(msg`Review the email below before sending.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Unable to generate preview`),
        description:
          error.userMessage || error.message || _(msg`Please check the subject and HTML body.`),
        variant: 'destructive',
      });
    }
  };

  const onConfirmSend = async () => {
    const values = form.getValues();

    try {
      const result = await notifyResellers(values);

      setIsConfirmOpen(false);

      if (result.failedCount > 0) {
        toast({
          title: _(msg`Notification partially sent`),
          description: _(
            msg`Sent to ${result.sentCount} of ${result.recipientCount} resellers. ${result.failedCount} failed.`,
          ),
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: _(msg`Notification sent`),
        description: _(msg`Email delivered to ${result.sentCount} active resellers.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Unable to send notification`),
        description: error.userMessage || error.message || _(msg`An unexpected error occurred.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border border-border bg-background p-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              <Trans>Active reseller recipients</Trans>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRecipientsLoading ? (
                <Trans>Loading recipient list…</Trans>
              ) : recipientCount === 0 ? (
                <Trans>No active resellers are currently available to notify.</Trans>
              ) : (
                recipientSummary
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="w-fit font-normal">
            {isRecipientsLoading ? '…' : recipientCount}{' '}
            {recipientCount === 1 ? <Trans>recipient</Trans> : <Trans>recipients</Trans>}
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRecipientsLoading || recipientCount === 0}
            onClick={() => setIsRecipientsOpen(true)}
          >
            <UsersIcon className="mr-2 h-4 w-4" />
            <Trans>View all</Trans>
          </Button>
        </div>
      </div>

      <Dialog open={isRecipientsOpen} onOpenChange={setIsRecipientsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <Trans>All reseller recipients</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                These {recipientCount} active reseller
                {recipientCount === 1 ? '' : 's'} will receive the notification.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">
                    <Trans>Name</Trans>
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <Trans>Email</Trans>
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <Trans>Organisation</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient) => (
                  <tr key={recipient.email} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 align-top font-medium text-foreground">
                      {recipient.name}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{recipient.email}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                      {recipient.organisationName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border bg-background p-5">
        <div className="mb-5 flex items-center gap-2">
          <MailIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            <Trans>Compose notification</Trans>
          </h2>
        </div>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onPreview)}>
            <fieldset disabled={isBusy} className="space-y-5">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Subject</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={_(msg`Email subject line`)} {...field} />
                    </FormControl>
                    <FormDescription>
                      <Trans>Used as the email subject only.</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="htmlBody"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>HTML message</Trans>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[320px] font-mono text-xs leading-5"
                        placeholder={EXAMPLE_HTML}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Paste the HTML message body. The Nomia logo is added at the top
                        automatically.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" variant="secondary" loading={isPreviewPending} disabled={isBusy}>
                <EyeIcon className="mr-2 h-4 w-4" />
                <Trans>Preview email</Trans>
              </Button>

              <Button
                type="button"
                loading={isNotifyPending}
                disabled={isBusy || recipientCount === 0}
                onClick={async () => {
                  const isValid = await form.trigger();

                  if (!isValid) {
                    return;
                  }

                  if (!previewHtml) {
                    await onPreview(form.getValues());
                  }

                  setIsConfirmOpen(true);
                }}
              >
                <SendIcon className="mr-2 h-4 w-4" />
                <Trans>Send to all resellers</Trans>
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <div className="rounded-lg border border-border bg-background p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EyeIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              <Trans>Email preview</Trans>
            </h2>
          </div>
          {previewSubject ? (
            <Badge variant="neutral" className="max-w-[60%] truncate font-normal">
              {previewSubject}
            </Badge>
          ) : null}
        </div>

        {previewHtml ? (
          <div className="overflow-hidden rounded-md border border-border bg-white">
            <iframe
              title={_(msg`Reseller notification preview`)}
              srcDoc={previewHtml}
              className="min-h-[720px] w-full bg-white"
              sandbox=""
            />
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
            <MailIcon className="mb-3 h-8 w-8 text-muted-foreground/70" />
            <p className="text-sm font-medium">
              <Trans>No preview yet</Trans>
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              <Trans>
                Enter a subject and HTML message, then click Preview email to review the full email
                below.
              </Trans>
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Send notification to all resellers?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <Trans>
                    This will email {recipientCount} active reseller
                    {recipientCount === 1 ? '' : 's'} with the subject below. This action cannot be
                    undone.
                  </Trans>
                </p>
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-medium text-foreground">
                  {form.getValues('subject') || _(msg`Untitled notification`)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isNotifyPending}>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isNotifyPending}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmSend();
              }}
            >
              {isNotifyPending ? <Trans>Sending…</Trans> : <Trans>Send email</Trans>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
