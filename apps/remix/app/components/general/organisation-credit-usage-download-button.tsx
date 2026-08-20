import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

type OrganisationCreditUsageDownloadButtonProps = {
  organisationId: string;
  organisationUrl: string;
};

const escapeCsvValue = (value: string | number | null) => {
  const stringValue = value == null ? '' : String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
};

export const OrganisationCreditUsageDownloadButton = ({
  organisationId,
  organisationUrl,
}: OrganisationCreditUsageDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const { mutateAsync: exportCreditUsage, isPending } =
    trpc.organisation.exportCreditUsage.useMutation();

  const onDownloadClick = async () => {
    try {
      const exportData = await exportCreditUsage({ organisationId });

      const header = ['Created At', 'Team ID', 'Team Name', 'Document ID', 'Credits'];
      const rows = exportData.data.map((row) => [
        new Date(row.createdAt).toISOString(),
        row.teamId,
        row.teamName ?? '',
        row.documentId,
        row.credits,
      ]);

      const csv = [header, ...rows]
        .map((line) => line.map((value) => escapeCsvValue(value)).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

      downloadFile({
        data: blob,
        filename: `${organisationUrl}-credit-usage.csv`,
      });

      toast({
        title: _(msg`Credit usage downloaded`),
        description: _(msg`${exportData.totalCredits} credits across ${exportData.count} records.`),
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the credit usage. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button variant="outline" loading={isPending} onClick={() => void onDownloadClick()}>
      {!isPending && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      <Trans>Download credit usage</Trans>
    </Button>
  );
};
