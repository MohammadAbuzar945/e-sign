import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import {
  TEAM_AUDIT_LOG_EXPORT_DATE_RANGES,
  type TTeamAuditLogExportDateRange,
} from '@documenso/lib/constants/team-audit-logs';
import { base64 } from '@documenso/lib/universal/base64';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';

const DATE_RANGE_LABELS: Record<TTeamAuditLogExportDateRange, string> = {
  '1_WEEK': '1 week',
  '30_DAYS': '30 days',
  '90_DAYS': '90 days',
  ALL_TIME: 'All time (max 1 year)',
};

export type TeamAuditLogDownloadButtonProps = {
  className?: string;
  teamId: number;
};

export const TeamAuditLogDownloadButton = ({
  className,
  teamId,
}: TeamAuditLogDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<TTeamAuditLogExportDateRange>('30_DAYS');
  const [jobId, setJobId] = useState<string | null>(null);
  const downloadTriggeredRef = useRef(false);

  const { mutateAsync: exportTeamAuditLogsCsv, isPending: isExportPending } =
    trpc.team.auditLog.exportCsv.useMutation();

  const exportStatusQuery = trpc.team.auditLog.exportCsvStatus.useQuery(
    {
      teamId,
      jobId: jobId ?? '',
    },
    {
      enabled: Boolean(jobId),
      refetchInterval: 1500,
    },
  );

  const onExportAuditLogsClick = async () => {
    try {
      const result = await exportTeamAuditLogsCsv({ teamId, dateRange });

      downloadTriggeredRef.current = false;
      setJobId(result.jobId);
      setOpen(false);

      toast({
        title: _(msg`Export started`),
        description: _(msg`We’re generating your CSV. This may take a moment.`),
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to export the team audit logs. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const data = exportStatusQuery.data;

    if (!data || !jobId) {
      return;
    }

    if (data.status === 'FAILED') {
      toast({
        title: _(msg`Export failed`),
        description:
          data.error ??
          _(msg`Sorry, we were unable to export the team audit logs. Please try again later.`),
        variant: 'destructive',
      });

      downloadTriggeredRef.current = false;
      setJobId(null);
      return;
    }

    if (data.status !== 'COMPLETED' || !data.download || downloadTriggeredRef.current) {
      return;
    }

    const download = data.download;
    downloadTriggeredRef.current = true;

    void (async () => {
      try {
        const filename = data.filename ?? 'Team Audit Logs.csv';

        if (download.kind === 'url') {
          const response = await fetch(download.url);
          const blob = await response.blob();

          downloadFile({
            data: blob,
            filename,
          });

          return;
        }

        const buffer = new Uint8Array(base64.decode(download.data));
        const blob = new Blob([buffer], { type: 'text/csv' });

        downloadFile({
          data: blob,
          filename,
        });
      } catch (error) {
        console.error(error);

        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`Sorry, we were unable to download the exported CSV. Please try again later.`,
          ),
          variant: 'destructive',
        });
      } finally {
        downloadTriggeredRef.current = false;
        setJobId(null);
      }
    })();
  }, [exportStatusQuery.data, jobId, toast, _]);

  const isPending = isExportPending || Boolean(jobId);

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button className={cn('w-full sm:w-auto', className)} loading={isPending} disabled={isPending}>
          {!isPending && <DownloadIcon className="mr-1.5 h-4 w-4" />}
          <Trans>Export Team Audit Logs (CSV)</Trans>
        </Button>
      </DialogTrigger>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Export audit logs</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Choose the time range for the audit log export.</Trans>
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={dateRange}
          onValueChange={(value) => setDateRange(value as TTeamAuditLogExportDateRange)}
          className="grid gap-3 py-2"
        >
          {TEAM_AUDIT_LOG_EXPORT_DATE_RANGES.map((range) => (
            <div key={range} className="flex items-center space-x-2">
              <RadioGroupItem value={range} id={`date-range-${range}`} />
              <Label htmlFor={`date-range-${range}`} className="cursor-pointer font-normal">
                {DATE_RANGE_LABELS[range]}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button onClick={() => void onExportAuditLogsClick()} loading={isExportPending}>
            <Trans>Export</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

