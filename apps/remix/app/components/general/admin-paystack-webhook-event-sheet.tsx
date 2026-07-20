import { useMemo, useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { PAYSTACK_WEBHOOK_EVENT_STATUS } from '@documenso/lib/constants/paystack-webhook-event-status';

import type { TFindPaystackWebhookEventsResponse } from '@documenso/trpc/server/admin-router/find-paystack-webhook-events.types';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Sheet, SheetContent, SheetTitle } from '@documenso/ui/primitives/sheet';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminPaystackWebhookEventSheetProps = {
  webhookEvent: TFindPaystackWebhookEventsResponse['data'][number];
  onClose: () => void;
};

export const AdminPaystackWebhookEventSheet = ({
  webhookEvent,
  onClose,
}: AdminPaystackWebhookEventSheetProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'payload' | 'result'>('payload');

  const generalDetails = useMemo(() => {
    return [
      {
        header: t`Status`,
        value: webhookEvent.status,
      },
      {
        header: t`Event`,
        value: webhookEvent.event,
      },
      {
        header: t`Received`,
        value: i18n.date(webhookEvent.createdAt, {
          dateStyle: 'medium',
          timeStyle: 'medium',
        }),
      },
      {
        header: t`Processed`,
        value: webhookEvent.processedAt
          ? i18n.date(webhookEvent.processedAt, {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })
          : '—',
      },
      {
        header: t`Reference`,
        value: webhookEvent.reference ?? '—',
      },
      {
        header: t`Customer`,
        value: webhookEvent.customerEmail ?? '—',
      },
      {
        header: t`Error`,
        value: webhookEvent.error ?? '—',
      },
    ];
  }, [i18n, t, webhookEvent]);

  const activeJson =
    activeTab === 'payload' ? webhookEvent.payload : (webhookEvent.result ?? null);

  return (
    <Sheet open={true} onOpenChange={(value) => (!value ? onClose() : null)}>
      <SheetContent
        position="right"
        size="lg"
        className="w-full max-w-[100vw] overflow-y-auto sm:max-w-2xl"
      >
        <SheetTitle>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              <Trans>Paystack Webhook</Trans>
            </h2>
            <Badge
              variant={
                webhookEvent.status === PAYSTACK_WEBHOOK_EVENT_STATUS.SUCCESS
                  ? 'default'
                  : webhookEvent.status === PAYSTACK_WEBHOOK_EVENT_STATUS.FAILED
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {webhookEvent.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-xs">{webhookEvent.id}</p>
        </SheetTitle>

        <div className="flex-1 overflow-y-auto">
          <div className="mt-6">
            <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
              <Trans>Details</Trans>
            </h4>
            <div className="border-border overflow-hidden rounded-lg border">
              <table className="w-full text-left text-sm">
                <tbody className="divide-border bg-muted/30 divide-y">
                  {generalDetails.map(({ header, value }) => (
                    <tr key={header}>
                      <td className="text-muted-foreground border-border w-1/3 border-r px-4 py-2 font-mono text-xs">
                        {header}
                      </td>
                      <td className="text-foreground break-all px-4 py-2 font-mono text-xs">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="py-6">
            <div className="border-border mb-4 flex items-center gap-4 border-b">
              <button
                type="button"
                onClick={() => setActiveTab('payload')}
                className={cn(
                  'relative pb-2 text-sm font-medium transition-colors',
                  activeTab === 'payload'
                    ? 'text-foreground after:bg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Trans>Payload</Trans>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('result')}
                className={cn(
                  'relative pb-2 text-sm font-medium transition-colors',
                  activeTab === 'result'
                    ? 'text-foreground after:bg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Trans>Result</Trans>
              </button>
            </div>

            <div className="group relative">
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyTextButton
                  value={JSON.stringify(activeJson, null, 2)}
                  onCopySuccess={() => toast({ title: t`Copied to clipboard` })}
                />
              </div>
              <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-relaxed">
                {JSON.stringify(activeJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
