import { useEffect, useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import {
  getResellerApplicationStatusLabel,
  getResellerProfileStatusLabel,
  isResellerAdminView,
  RESELLER_ADMIN_VIEW,
  type ResellerAdminView,
} from '@documenso/lib/constants/reseller-application-status';
import { AppError } from '@documenso/lib/errors/app-error';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AdminResellerApplicationActionDialog } from '~/components/dialogs/admin-reseller-application-action-dialog';
import { AdminVerifyResellerBankDialog } from '~/components/dialogs/admin-verify-reseller-bank-dialog';
import { SendResellerTermsDialog } from '~/components/dialogs/send-reseller-terms-dialog';
import { AdminResellerApplicationActionsPanel } from '~/components/general/admin-reseller-application-actions-panel';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

const getAdminView = (value: string | null): ResellerAdminView => {
  if (isResellerAdminView(value)) {
    return value;
  }

  return RESELLER_ADMIN_VIEW.QUEUE;
};

export const AdminResellerApplicationsTable = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isVerifyBankDialogOpen, setIsVerifyBankDialogOpen] = useState(false);
  const [applicationAction, setApplicationAction] = useState<'reject' | 'cancel' | null>(null);
  const [profileAction, setProfileAction] = useState<'deactivate' | 'reactivate' | 'delete' | null>(
    null,
  );

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));
  const view = getAdminView(searchParams.get('view'));

  const { data, isLoading, isLoadingError, refetch } = trpc.admin.resellerApplications.find.useQuery(
    {
      query: parsedSearchParams.query,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
      view,
    },
  );

  useEffect(() => {
    setSelectedId(null);
  }, [view, parsedSearchParams.query, parsedSearchParams.page]);

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

  const rowSelection = useMemo(() => {
    if (!selectedId) {
      return {};
    }

    return { [selectedId]: true };
  }, [selectedId]);

  const selectedApplication = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return results.data.find((application) => application.id === selectedId) ?? null;
  }, [results.data, selectedId]);

  const handleMutationSuccess = async () => {
    setSelectedId(null);
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

  const { mutateAsync: updateAllowNegativeCredits, isPending: isUpdatingAllowNegativeCredits } =
    trpc.admin.resellerApplications.updateAllowNegativeCredits.useMutation({
      onSuccess: async (_result, variables) => {
        toast({
          title: variables.allowNegativeCredits
            ? t`Negative credits enabled`
            : t`Negative credits disabled`,
          description: variables.allowNegativeCredits
            ? t`This reseller can now go below zero when fulfilling client purchases.`
            : t`This reseller must maintain enough credits before clients are topped up automatically.`,
        });

        await handleMutationSuccess();
      },
      onError: (error) => {
        toast({
          title: t`Update failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: refreshBankAccountStatus, isPending: isRefreshingBankStatus } =
    trpc.admin.resellerApplications.refreshBankAccountStatus.useMutation({
      onSuccess: async (result) => {
        toast({
          title:
            result.subaccountStatus === 'ACTIVE'
              ? t`Bank account verified`
              : t`Verification still pending`,
          description:
            result.subaccountStatus === 'ACTIVE'
              ? t`Paystack confirmed this subaccount is verified.`
              : t`Paystack still reports this subaccount as unverified.`,
        });

        await refetch();
      },
      onError: (error) => {
        toast({
          title: t`Refresh failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: retrySubaccount, isPending: isRetryingSubaccount } =
    trpc.admin.resellerApplications.retrySubaccount.useMutation({
      onSuccess: async (result) => {
        toast({
          title: t`Subaccount updated`,
          description:
            result.subaccountStatus === 'ACTIVE'
              ? t`The Paystack subaccount is verified and ready.`
              : t`The Paystack subaccount was created or updated. Verification may still be pending.`,
        });

        await refetch();
      },
      onError: (error) => {
        toast({
          title: t`Retry failed`,
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const columns = useMemo(() => {
    type Row = (typeof results)['data'][number];

    const selectColumn: DataTableColumnDef<Row> = {
      id: 'select',
      header: () => null,
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(value) => {
            setSelectedId(value ? row.id : null);
          }}
          aria-label={t`Select row`}
        />
      ),
      maxSize: 40,
    };

    const organisationColumn: DataTableColumnDef<Row> = {
      header: t`Organisation`,
      accessorKey: 'snapshotOrgName',
    };

    const applicantColumn: DataTableColumnDef<Row> = {
      header: t`Applicant`,
      cell: ({ row }) => (
        <div>
          <p>{row.original.snapshotApplicantName}</p>
          <p className="text-xs text-muted-foreground">{row.original.snapshotApplicantEmail}</p>
        </div>
      ),
    };

    if (view === RESELLER_ADMIN_VIEW.ACCOUNTS) {
      return [
        selectColumn,
        organisationColumn,
        applicantColumn,
        {
          header: t`Account`,
          cell: ({ row }) => {
            const status = row.original.resellerProfile?.status;

            if (!status) {
              return '—';
            }

            return (
              <Badge variant={status === 'ACTIVE' ? 'default' : 'neutral'}>
                {getResellerProfileStatusLabel(status)}
              </Badge>
            );
          },
        },
        {
          header: t`Payouts`,
          cell: ({ row }) => {
            const profile = row.original.resellerProfile;

            if (!profile) {
              return '—';
            }

            if (profile.payoutReadiness?.canAcceptPayments) {
              return (
                <Badge variant="default">
                  <Trans>Ready</Trans>
                </Badge>
              );
            }

            return (
              <Badge variant="neutral">
                <Trans>Not ready</Trans>
              </Badge>
            );
          },
        },
        {
          header: t`Credits`,
          cell: ({ row }) => {
            const profile = row.original.resellerProfile;

            if (!profile) {
              return '—';
            }

            const negativeUsed = profile.negativeCreditsUsed ?? 0;

            return (
              <div className="text-sm">
                <p>{profile.availableCredits ?? 0}</p>
                {negativeUsed > 0 ? (
                  <p className="text-xs font-medium text-amber-700">
                    <Trans>{negativeUsed} negative</Trans>
                  </p>
                ) : null}
              </div>
            );
          },
        },
        {
          header: t`Applied`,
          cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
        },
      ] satisfies DataTableColumnDef<Row>[];
    }

    if (view === RESELLER_ADMIN_VIEW.CLOSED) {
      return [
        selectColumn,
        organisationColumn,
        applicantColumn,
        {
          header: t`Status`,
          cell: ({ row }) => {
            const statusLabel = getResellerApplicationStatusLabel(
              row.original.status,
              row.original.rejectionReason,
            );

            return <Badge variant="destructive">{statusLabel}</Badge>;
          },
        },
        {
          header: t`Applied`,
          cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
        },
      ] satisfies DataTableColumnDef<Row>[];
    }

    return [
      selectColumn,
      organisationColumn,
      applicantColumn,
      {
        header: t`Status`,
        cell: ({ row }) => {
          const statusLabel = getResellerApplicationStatusLabel(
            row.original.status,
            row.original.rejectionReason,
          );

          return (
            <Badge
              variant={
                row.original.status === 'TERMS_COMPLETED'
                  ? 'default'
                  : row.original.status === 'TERMS_SENT'
                    ? 'secondary'
                    : 'neutral'
              }
            >
              {statusLabel}
            </Badge>
          );
        },
      },
      {
        header: t`Applied`,
        cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
      },
    ] satisfies DataTableColumnDef<Row>[];
  }, [t, view]);

  const skeletonColumnCount =
    view === RESELLER_ADMIN_VIEW.ACCOUNTS ? 7 : view === RESELLER_ADMIN_VIEW.CLOSED ? 5 : 5;

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
          {!selectedApplication && (
            <p className="text-sm text-muted-foreground">
              {view === RESELLER_ADMIN_VIEW.ACCOUNTS ? (
                <Trans>Select an account in the table to manage credits, payouts, and status.</Trans>
              ) : (
                <Trans>Select an application in the table to view details and available actions.</Trans>
              )}
            </p>
          )}

          <DataTable
            columns={columns}
            data={results.data}
            perPage={results.perPage}
            currentPage={results.currentPage}
            totalPages={results.totalPages}
            onPaginationChange={onPaginationChange}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={(selection) => {
              const selectedIds = Object.keys(selection).filter((key) => selection[key]);
              const newlySelectedId = selectedIds.find((id) => id !== selectedId);
              setSelectedId(newlySelectedId ?? selectedIds[0] ?? null);
            }}
            onRowClick={(row) => {
              setSelectedId((current) => (current === row.id ? null : row.id));
            }}
            getRowId={(row) => row.id}
            error={{
              enable: isLoadingError,
            }}
            skeleton={{
              enable: isLoading,
              rows: 3,
              component: (
                <>
                  {Array.from({ length: skeletonColumnCount }).map((_, index) => (
                    <TableCell key={index}>
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </TableCell>
                  ))}
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
            view={view}
            isRetryingActivation={isRetryingActivation}
            isUpdatingAllowNegativeCredits={isUpdatingAllowNegativeCredits}
            isRefreshingBankStatus={isRefreshingBankStatus}
            isRetryingSubaccount={isRetryingSubaccount}
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
            onAllowNegativeCreditsChange={async (allowNegativeCredits) => {
              await updateAllowNegativeCredits({
                applicationId: selectedApplication.id,
                allowNegativeCredits,
              });
            }}
            onVerifyBankAccount={() => setIsVerifyBankDialogOpen(true)}
            onRefreshBankStatus={async () => {
              await refreshBankAccountStatus({
                applicationId: selectedApplication.id,
              });
            }}
            onRetrySubaccount={async () => {
              await retrySubaccount({
                applicationId: selectedApplication.id,
              });
            }}
          />
        )}
      </div>

      <SendResellerTermsDialog
        application={selectedApplication}
        open={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        onSuccess={handleMutationSuccess}
      />

      <AdminVerifyResellerBankDialog
        applicationId={isVerifyBankDialogOpen ? selectedApplication?.id ?? null : null}
        organisationName={selectedApplication?.snapshotOrgName ?? null}
        bankName={selectedApplication?.resellerProfile?.bankName ?? null}
        bankAccountName={selectedApplication?.resellerProfile?.bankAccountName ?? null}
        bankAccountNumber={selectedApplication?.resellerProfile?.bankAccountNumber ?? null}
        bankAccountType={selectedApplication?.resellerProfile?.bankAccountType ?? null}
        bankDocumentType={selectedApplication?.resellerProfile?.bankDocumentType ?? null}
        open={isVerifyBankDialogOpen}
        onOpenChange={setIsVerifyBankDialogOpen}
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
              disabled={!selectedApplication || isDeactivating || isReactivating || isDeleting}
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
