import { useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

import { AppError } from '@documenso/lib/errors/app-error';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { SendResellerTermsDialog } from '~/components/dialogs/send-reseller-terms-dialog';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useSearchParams } from 'react-router';

export const AdminResellerApplicationsTable = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError, refetch } = trpc.admin.resellerApplications.find.useQuery(
    {
      query: parsedSearchParams.query,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
    },
  );

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const selectedApplicationIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);

  const selectedApplication = useMemo(() => {
    if (selectedApplicationIds.length !== 1) {
      return null;
    }

    return results.data.find((application) => application.id === selectedApplicationIds[0]) ?? null;
  }, [results.data, selectedApplicationIds]);

  const { mutateAsync: retryActivation, isPending: isRetryingActivation } =
    trpc.admin.resellerApplications.retryActivation.useMutation({
      onSuccess: async () => {
        toast({
          title: t`Reseller activated`,
          description: t`The application has been marked as approved.`,
        });

        setRowSelection({});
        await refetch();
      },
      onError: (error) => {
        toast({
          title: t`Activation failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const canRetryActivation =
    selectedApplication?.status === 'TERMS_SENT' || selectedApplication?.status === 'TERMS_COMPLETED';

  const columns = useMemo(() => {
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        maxSize: 40,
      },
      {
        header: t`Organisation`,
        accessorKey: 'snapshotOrgName',
      },
      {
        header: t`Applicant`,
        cell: ({ row }) => (
          <div>
            <p>{row.original.snapshotApplicantName}</p>
            <p className="text-xs text-muted-foreground">{row.original.snapshotApplicantEmail}</p>
          </div>
        ),
      },
      {
        header: t`Completed docs`,
        cell: ({ row }) => row.original.liveCompletedDocCount,
      },
      {
        header: t`Signup date`,
        cell: ({ row }) => new Date(row.original.snapshotOrgSignupDate).toLocaleDateString(),
      },
      {
        header: t`Unique signers`,
        cell: ({ row }) => row.original.liveUniqueSignerCount,
      },
      {
        header: t`Users`,
        cell: ({ row }) => row.original.liveOrgUserCount,
      },
      {
        header: t`Status`,
        accessorKey: 'status',
      },
      {
        header: t`Applied`,
        cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [t]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={selectedApplicationIds.length !== 1 || !canRetryActivation || isRetryingActivation}
          loading={isRetryingActivation}
          onClick={async () => {
            if (!selectedApplication) {
              return;
            }

            await retryActivation({
              applicationId: selectedApplication.id,
            });
          }}
        >
          <Trans>Activate reseller</Trans>
        </Button>

        <Button
          disabled={selectedApplicationIds.length !== 1}
          onClick={() => {
            if (selectedApplicationIds.length !== 1) {
              toast({
                title: t`Select one application`,
                description: t`Select exactly one application to enter T&C variables before sending.`,
                variant: 'destructive',
              });

              return;
            }

            setIsSendDialogOpen(true);
          }}
        >
          <Trans>Send T&Cs</Trans>
        </Button>
      </div>

      <SendResellerTermsDialog
        application={selectedApplication}
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        onSuccess={async () => {
          setRowSelection({});
          await refetch();
        }}
      />

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row.id}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading,
          rows: 3,
          component: (
            <>
              <TableCell>
                <Skeleton className="h-4 w-4 rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16 rounded-full" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>
    </div>
  );
};
