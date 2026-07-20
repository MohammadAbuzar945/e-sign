import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError } from '@documenso/lib/errors/app-error';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { useToast } from '@documenso/ui/primitives/use-toast';

import {
  AdminResellerBulkRatesEditor,
  formatBulkRateTierSummary,
  type BulkRateTierDraft,
} from '~/components/general/admin-reseller-bulk-rates-editor';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reseller-bulk-rates';

export function meta() {
  return appMetaTags('Reseller bulk rates');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user?.email || !isResellerFeatureAllowedEmail(user.email)) {
    throw redirect('/admin');
  }

  return null;
}

const formatZarFromCents = (cents: number) => `ZAR ${(cents / 100).toFixed(2)}`;

export default function AdminResellerBulkRatesPage() {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.admin.resellerBulkRates.listGlobal.useQuery();

  const { mutateAsync: replaceGlobal, isPending } =
    trpc.admin.resellerBulkRates.replaceGlobal.useMutation({
      onSuccess: async () => {
        await refetch();
        toast({ title: _(msg`Global bulk rates saved`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Could not save bulk rates`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const initialTiers: BulkRateTierDraft[] =
    data?.tiers.map((tier) => ({
      minCredits: tier.minCredits,
      pricePerCreditCents: tier.pricePerCreditCents,
      isEnabled: tier.isEnabled,
    })) ?? [];

  const summary = formatBulkRateTierSummary(initialTiers);

  return (
    <div className="w-full min-w-0 max-w-4xl">
      <SettingsHeader
        title={_(msg`Reseller bulk rates`)}
        subtitle={_(
          msg`Default volume sliding-scale rates for all resellers. Individual resellers can override these from the Accounts view.`,
        )}
      />

      {summary ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {summary.tiers.map((tier) => (
            <Badge key={tier.minCredits} variant="neutral" className="font-normal">
              {tier.minCredits.toLocaleString()}+ · {formatZarFromCents(tier.pricePerCreditCents)}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Loading rates…</Trans>
          </p>
        ) : (
          <AdminResellerBulkRatesEditor
            initialTiers={initialTiers}
            isSaving={isPending}
            onSave={async (tiers) => {
              await replaceGlobal({ tiers });
            }}
          />
        )}
      </div>
    </div>
  );
}
