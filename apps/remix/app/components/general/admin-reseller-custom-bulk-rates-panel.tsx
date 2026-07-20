import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { LayersIcon, PencilIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  AdminResellerBulkRatesEditor,
  formatBulkRateTierSummary,
  type BulkRateTierDraft,
} from '~/components/general/admin-reseller-bulk-rates-editor';

type AdminResellerCustomBulkRatesPanelProps = {
  resellerProfileId: string;
};

const formatZarFromCents = (cents: number) => `ZAR ${(cents / 100).toFixed(2)}`;

const BulkRateSummaryList = ({ tiers }: { tiers: BulkRateTierDraft[] }) => {
  const summary = formatBulkRateTierSummary(tiers);

  if (!summary) {
    return (
      <p className="text-xs text-muted-foreground">
        <Trans>No active tiers configured.</Trans>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {summary.tiers.slice(0, 3).map((tier) => (
          <Badge key={tier.minCredits} variant="neutral" className="font-normal">
            {tier.minCredits.toLocaleString()}+ · {formatZarFromCents(tier.pricePerCreditCents)}
          </Badge>
        ))}
        {summary.tiers.length > 3 ? (
          <Badge variant="neutral" className="font-normal">
            +{summary.tiers.length - 3} more
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        <Trans>
          From {formatZarFromCents(summary.lowestRateCents)} per credit across {summary.tierCount}{' '}
          {summary.tierCount === 1 ? 'tier' : 'tiers'}.
        </Trans>
      </p>
    </div>
  );
};

export const AdminResellerCustomBulkRatesPanel = ({
  resellerProfileId,
}: AdminResellerCustomBulkRatesPanelProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const editorFormId = useId();

  const { data, isLoading, refetch } = trpc.admin.resellerBulkRates.getForReseller.useQuery({
    resellerProfileId,
  });

  const { data: globalRates } = trpc.admin.resellerBulkRates.listGlobal.useQuery();

  const { mutateAsync: replaceForReseller, isPending } =
    trpc.admin.resellerBulkRates.replaceForReseller.useMutation({
      onSuccess: async () => {
        await refetch();
        toast({ title: _(msg`Reseller bulk rates saved`) });
        setIsEditorOpen(false);
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not save reseller bulk rates`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const initialTiers: BulkRateTierDraft[] = useMemo(() => {
    if (!data) {
      return [];
    }

    if (data.tiers.length > 0) {
      return data.tiers.map((tier) => ({
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      }));
    }

    return [
      {
        minCredits: 500,
        pricePerCreditCents: 600,
        isEnabled: true,
      },
    ];
  }, [data]);

  const effectiveTiers = useMemo(() => {
    if (!data) {
      return [];
    }

    if (data.bulkRatesUseCustom) {
      return initialTiers;
    }

    return (
      globalRates?.tiers.map((tier) => ({
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled,
      })) ?? []
    );
  }, [data, globalRates?.tiers, initialTiers]);

  if (isLoading || !data) {
    return (
      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Trans>Bulk inventory rates</Trans>
        </p>
        <p className="text-xs text-muted-foreground">
          <Trans>Loading bulk rates…</Trans>
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            <Trans>Bulk inventory rates</Trans>
          </p>
        </div>

        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor={`custom-bulk-rates-${resellerProfileId}`} className="text-sm font-medium">
                <Trans>Use custom bulk rates</Trans>
              </Label>
              <p className="text-xs text-muted-foreground">
                {data.bulkRatesUseCustom ? (
                  <Trans>This reseller uses an override rate table.</Trans>
                ) : (
                  <Trans>This reseller uses the global Nomia bulk rate table.</Trans>
                )}
              </p>
            </div>
            <Switch
              id={`custom-bulk-rates-${resellerProfileId}`}
              checked={data.bulkRatesUseCustom}
              disabled={isPending}
              onCheckedChange={async (checked) => {
                await replaceForReseller({
                  resellerProfileId,
                  bulkRatesUseCustom: checked,
                  tiers: checked
                    ? initialTiers
                    : data.tiers.map((tier) => ({
                        minCredits: tier.minCredits,
                        pricePerCreditCents: tier.pricePerCreditCents,
                        isEnabled: tier.isEnabled,
                      })),
                });
              }}
            />
          </div>

          <BulkRateSummaryList tiers={effectiveTiers} />

          <div className="flex flex-wrap gap-2">
            {data.bulkRatesUseCustom ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditorOpen(true)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                <Trans>Edit custom rates</Trans>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to="/admin/reseller-bulk-rates">
                  <Trans>View global rates</Trans>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl gap-0 p-0">
          <DialogHeader className="space-y-2 border-b px-6 py-5">
            <DialogTitle>
              <Trans>Custom bulk rates</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Volume tiers for this reseller. Larger orders automatically use the best matching
                rate.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <AdminResellerBulkRatesEditor
              formId={editorFormId}
              initialTiers={initialTiers}
              isSaving={isPending}
              showFooter={false}
              showAddTier={true}
              showHelperText={false}
              onSave={async (tiers) => {
                await replaceForReseller({
                  resellerProfileId,
                  bulkRatesUseCustom: true,
                  tiers,
                });
              }}
            />
          </div>

          <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" form={editorFormId} loading={isPending}>
              <Trans>Save rates</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
