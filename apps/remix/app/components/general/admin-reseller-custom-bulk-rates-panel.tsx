import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  AdminResellerBulkRatesEditor,
  type BulkRateTierDraft,
} from '~/components/general/admin-reseller-bulk-rates-editor';

type AdminResellerCustomBulkRatesPanelProps = {
  resellerProfileId: string;
};

export const AdminResellerCustomBulkRatesPanel = ({
  resellerProfileId,
}: AdminResellerCustomBulkRatesPanelProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.admin.resellerBulkRates.getForReseller.useQuery({
    resellerProfileId,
  });

  const { mutateAsync: replaceForReseller, isPending } =
    trpc.admin.resellerBulkRates.replaceForReseller.useMutation({
      onSuccess: async () => {
        await refetch();
        toast({ title: _(msg`Reseller bulk rates saved`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not save reseller bulk rates`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  if (isLoading || !data) {
    return (
      <p className="text-xs text-muted-foreground">
        <Trans>Loading bulk rates…</Trans>
      </p>
    );
  }

  const initialTiers: BulkRateTierDraft[] =
    data.tiers.length > 0
      ? data.tiers.map((tier) => ({
          minCredits: tier.minCredits,
          pricePerCreditCents: tier.pricePerCreditCents,
          isEnabled: tier.isEnabled,
        }))
      : [
          {
            minCredits: 500,
            pricePerCreditCents: 600,
            isEnabled: true,
          },
        ];

  return (
    <section className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Bulk inventory rates</Trans>
      </p>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-1">
          <Label htmlFor={`custom-bulk-rates-${resellerProfileId}`} className="text-sm font-medium">
            <Trans>Use custom bulk rates</Trans>
          </Label>
          <p className="text-xs text-muted-foreground">
            <Trans>
              When off, this reseller uses the global Nomia bulk rate table.
            </Trans>
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

      {data.bulkRatesUseCustom ? (
        <div className="rounded-md border p-3">
          <AdminResellerBulkRatesEditor
            initialTiers={initialTiers}
            isSaving={isPending}
            onSave={async (tiers) => {
              await replaceForReseller({
                resellerProfileId,
                bulkRatesUseCustom: true,
                tiers,
              });
            }}
          />
        </div>
      ) : null}
    </section>
  );
};
