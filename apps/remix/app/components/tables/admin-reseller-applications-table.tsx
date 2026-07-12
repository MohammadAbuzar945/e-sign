import { useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';

import { AppError } from '@documenso/lib/errors/app-error';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { getResellerApplicationStatusLabel } from '@documenso/lib/server-only/reseller/reject-reseller-application-from-terms-rejection';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AdminResellerApplicationActionsPanel } from '~/components/general/admin-reseller-application-actions-panel';
import { AdminResellerApplicationActionDialog } from '~/components/dialogs/admin-reseller-application-action-dialog';
import { SendResellerTermsDialog } from '~/components/dialogs/send-reseller-terms-dialog';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
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
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const AdminResellerApplicationsTable = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [applicationAction, setApplicationAction] = useState<'reject' | 'cancel' | null>(null);
  const [profileAction, setProfileAction] = useState<'deactivate' | 'reactivate' | 'delete' | null>(
    null,
  );

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

  const handleMutationSuccess = async () => {
    setRowSelection({});
    await refetch();
  };

  const { mutateAsync: retryActivation, isPending: isRetryingActivation } =
    trpc.admin.resellerApplications.retryActivation.useMutation({
      onSuccess: async () => {
        toast({
          title: t`Reseller activated`,
          description: t`The application has been marked as approved.`,
        });

        await handleMutationSuccess();
      },
      onError: (error) => {
        toast({
          title: t`Activation failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deactivateReseller, isPending: isDeactivating } =
    trpc.admin.resellerApplications.deactivate.useMutation({
      onSuccess: async () => {
        toast({
          title: t`Reseller deactivated`,
          description: t`The reseller profile has been deactivated.`,
        });

        setProfileAction(null);
        await handleMutationSuccess();
      },
      onError: (error) => {
        toast({
          title: t`Deactivation failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: reactivateReseller, isPending: isReactivating } =
    trpc.admin.resellerApplications.reactivate.useMutation({
      onSuccess: async () => {
        toast({
          title: t`Reseller reactivated`,
          description: t`The reseller profile is active again.`,
        });

        setProfileAction(null);
        await handleMutationSuccess();
      },
      onError: (error) => {
        toast({
          title: t`Reactivation failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deleteReseller, isPending: isDeleting } =
    trpc.admin.resellerApplications.delete.useMutation({
      onSuccess: async () => {
        toast({
          title: t`Reseller deleted`,
          description: t`The reseller profile and application record have been removed.`,
        });

        setProfileAction(null);
        await handleMutationSuccess();
      },
      onError: (error) => {
        toast({
          title: t`Delete failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

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
        header: t`Application status`,
        cell: ({ row }) => {
          const statusLabel = getResellerApplicationStatusLabel(
            row.original.status,
            row.original.rejectionReason,
          );

          return (
            <Badge
              variant={
                row.original.status === 'REJECTED' || row.original.status === 'CANCELLED'
                  ? 'destructive'
                  : row.original.status === 'APPROVED'
                    ? 'default'
                    : 'secondary'
              }
            >
              {statusLabel}
            </Badge>
          );
        },
      },
      {
        header: t`Reseller status`,
        cell: ({ row }) => row.original.resellerProfile?.status ?? '—',
      },
      {
        header: t`Applied`,
        cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [t]);

  return (
    <div className="space-y-4">
      {isLoadingError && (
        <Alert variant="destructive">
          <AlertTitle>
            <Trans>Unable to load applications</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              The reseller applications list failed to load. If you recently deployed, rebuild the
              server image without cache and confirm the latest commit is running.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {!selectedApplication && selectedApplicationIds.length === 0 && (
            <p className="text-sm text-muted-foreground">
              <Trans>Select an application in the table to view details and available actions.</Trans>
            </p>
          )}

          {selectedApplicationIds.length > 1 && (
            <p className="text-sm text-muted-foreground">
              <Trans>Select exactly one application to manage individual actions.</Trans>
            </p>
          )}

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

        {selectedApplication && (
          <AdminResellerApplicationActionsPanel
            application={selectedApplication}
            isRetryingActivation={isRetryingActivation}
            onSendTerms={() => setIsSendDialogOpen(true)}
            onActivate={async () => {
              await retryActivation({
                applicationId: selectedApplication.id,
              });
            }}
            onReject={() => setApplicationAction('reject')}
            onCancel={() => setApplicationAction('cancel')}
            onDeactivate={() => setProfileAction('deactivate')}
            onReactivate={() => setProfileAction('reactivate')}
            onDelete={() => setProfileAction('delete')}
          />
        )}
      </div>

      <SendResellerTermsDialog
        application={selectedApplication}
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        onSuccess={handleMutationSuccess}
      />

      <AdminResellerApplicationActionDialog
        action={applicationAction ?? 'reject'}
        applicationId={applicationAction ? selectedApplication?.id ?? null : null}
        organisationName={selectedApplication?.snapshotOrgName ?? null}
        open={applicationAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApplicationAction(null);
          }
        }}
        onSuccess={handleMutationSuccess}
      />

      <AlertDialog
        open={profileAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProfileAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {profileAction === 'deactivate' ? (
                <Trans>Deactivate</Trans>
              ) : profileAction === 'delete' ? (
                <Trans>Delete</Trans>
              ) : (
                <Trans>Reactivate</Trans>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {profileAction === 'deactivate' ? (
                <Trans>
                  Deactivating {selectedApplication?.snapshotOrgName ?? 'this organisation'} will
                  disable their affiliate page and block new credit purchases until reactivated.
                </Trans>
              ) : profileAction === 'delete' ? (
                <Trans>
                  Deleting {selectedApplication?.snapshotOrgName ?? 'this organisation'} permanently
                  removes their reseller profile, packages, transaction history, and application
                  record. The organisation can apply again later. This cannot be undone.
                </Trans>
              ) : (
                <Trans>
                  Reactivating {selectedApplication?.snapshotOrgName ?? 'this organisation'} will
                  restore their affiliate page and allow credit purchases again.
                </Trans>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating || isReactivating || isDeleting}>
              <Trans>Close</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              className={profileAction === 'reactivate' ? undefined : 'bg-destructive hover:bg-destructive/90'}
              disabled={
                !selectedApplication || isDeactivating || isReactivating || isDeleting
              }
              onClick={async (event) => {
                event.preventDefault();

                if (!selectedApplication) {
                  return;
                }

                if (profileAction === 'deactivate') {
                  await deactivateReseller({
                    applicationId: selectedApplication.id,
                  });
                }

                if (profileAction === 'reactivate') {
                  await reactivateReseller({
                    applicationId: selectedApplication.id,
                  });
                }

                if (profileAction === 'delete') {
                  await deleteReseller({
                    applicationId: selectedApplication.id,
                  });
                }
              }}
            >
              {profileAction === 'deactivate' ? (
                <Trans>Deactivate</Trans>
              ) : profileAction === 'delete' ? (
                <Trans>Delete</Trans>
              ) : (
                <Trans>Reactivate</Trans>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
