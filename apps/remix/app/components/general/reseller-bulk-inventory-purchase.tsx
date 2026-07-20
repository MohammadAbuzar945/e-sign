import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckCircle2Icon, PackageIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppError } from '@documenso/lib/errors/app-error';
import { matchBulkRateTier } from '@documenso/lib/utils/reseller-bulk-rate';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { cn } from '@documenso/ui/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

type ResellerBulkInventoryPurchaseProps = {
  organisationId: string;
};

const formatZarFromCents = (cents: number) => `ZAR ${(cents / 100).toFixed(2)}`;

export const ResellerBulkInventoryPurchase = ({
  organisationId,
}: ResellerBulkInventoryPurchaseProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [creditsInput, setCreditsInput] = useState('');

  const { data: rates, isLoading } = trpc.organisation.reseller.getEffectiveBulkRates.useQuery({
    organisationId,
  });

  const { mutateAsync: initializeBulkPurchase, isPending } =
    trpc.organisation.reseller.initializeBulkPurchase.useMutation({
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
      onError: (error) => {
        toast({
          title: _(msg`Bulk purchase failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const sortedTiers = useMemo(() => {
    if (!rates?.tiers.length) {
      return [];
    }

    return [...rates.tiers].sort((a, b) => a.minCredits - b.minCredits);
  }, [rates?.tiers]);

  const tiersWithDefaults = useMemo(
    () =>
      sortedTiers.map((tier) => ({
        ...tier,
        isEnabled: true,
      })),
    [sortedTiers],
  );

  const credits = Number(creditsInput);
  const hasValidCredits = Number.isInteger(credits) && credits > 0;

  const matchedTier = useMemo(() => {
    if (!tiersWithDefaults.length || !hasValidCredits) {
      return null;
    }

    return matchBulkRateTier({ credits, tiers: tiersWithDefaults });
  }, [credits, hasValidCredits, tiersWithDefaults]);

  const amountInCents =
    matchedTier && hasValidCredits ? credits * matchedTier.pricePerCreditCents : null;

  const minimumCredits = sortedTiers[0]?.minCredits ?? 1;

  const nextTier = useMemo(() => {
    if (!hasValidCredits || matchedTier) {
      return null;
    }

    return sortedTiers.find((tier) => tier.minCredits > credits) ?? null;
  }, [credits, hasValidCredits, matchedTier, sortedTiers]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        <Trans>Loading bulk rates…</Trans>
      </div>
    );
  }

  if (!rates || sortedTiers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-gray-700">
              <Trans>Reseller bulk inventory</Trans>
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            <Trans>
              Top up your reseller stock at wholesale volume rates. Retail packages below remain
              available for normal customer purchases.
            </Trans>
          </p>
        </div>
        <Badge variant={rates.source === 'CUSTOM' ? 'default' : 'neutral'}>
          {rates.source === 'CUSTOM' ? (
            <Trans>Custom wholesale rates</Trans>
          ) : (
            <Trans>Standard wholesale rates</Trans>
          )}
        </Badge>
      </div>

      <div className="rounded-xl border border-dashed border-purple-300 bg-gradient-to-br from-blue-50 to-purple-50 p-5">
        <p className="mb-3 text-sm font-medium text-gray-600">
          <Trans>Quick select</Trans>
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedTiers.map((tier) => {
            const isMatched = matchedTier?.minCredits === tier.minCredits;
            const exampleTotal = tier.minCredits * tier.pricePerCreditCents;

            return (
              <button
                key={tier.minCredits}
                type="button"
                className={cn(
                  'rounded-lg border bg-white/90 p-4 text-left transition hover:border-purple-400 hover:shadow-sm',
                  isMatched && 'border-purple-500 ring-2 ring-purple-200',
                )}
                onClick={() => {
                  setCreditsInput(String(tier.minCredits));
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-semibold text-gray-800">
                    {tier.minCredits.toLocaleString()}+ <Trans>credits</Trans>
                  </p>
                  {isMatched ? (
                    <CheckCircle2Icon className="h-5 w-5 shrink-0 text-purple-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatZarFromCents(tier.pricePerCreditCents)} <Trans>per credit</Trans>
                </p>
                <p className="mt-3 text-sm font-medium text-purple-700">
                  {formatZarFromCents(exampleTotal)} <Trans>from</Trans>
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="bulk-credits">
              <Trans>Credits to buy</Trans>
            </Label>
            <Input
              id="bulk-credits"
              type="number"
              min={minimumCredits}
              step={1}
              value={creditsInput}
              placeholder={String(minimumCredits)}
              onChange={(event) => {
                setCreditsInput(event.target.value);
              }}
            />
          </div>

          <Button
            className="w-full lg:w-auto"
            loading={isPending}
            disabled={!matchedTier || amountInCents === null}
            onClick={async () => {
              await initializeBulkPurchase({
                organisationId,
                credits,
              });
            }}
          >
            <Trans>Buy bulk inventory</Trans>
          </Button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border bg-white/90">
          <div className="border-b bg-white px-4 py-3">
            <p className="text-sm font-medium text-gray-700">
              <Trans>Live rate preview</Trans>
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your order uses the highest tier you qualify for. Enter a quantity to see which rate
                applies.
              </Trans>
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Tier</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Min credits</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Rate / credit</Trans>
                </TableHead>
                <TableHead>
                  <Trans>Your total</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTiers.map((tier, index) => {
                const isMatched = matchedTier?.minCredits === tier.minCredits;
                const creditsNeeded = tier.minCredits - credits;
                const orderTotalCents = hasValidCredits ? credits * tier.pricePerCreditCents : null;

                return (
                  <TableRow
                    key={tier.minCredits}
                    className={cn(isMatched && 'bg-purple-50/80 hover:bg-purple-50/80')}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>
                          <Trans>Tier {index + 1}</Trans>
                        </span>
                        {isMatched ? (
                          <Badge variant="default" className="font-normal">
                            <Trans>Matched</Trans>
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{tier.minCredits.toLocaleString()}+</TableCell>
                    <TableCell>{formatZarFromCents(tier.pricePerCreditCents)}</TableCell>
                    <TableCell>
                      {!hasValidCredits ? (
                        <span className="text-muted-foreground">—</span>
                      ) : isMatched && orderTotalCents !== null ? (
                        <span className="font-semibold text-purple-700">
                          {formatZarFromCents(orderTotalCents)}
                        </span>
                      ) : hasValidCredits && credits < tier.minCredits ? (
                        <span className="text-muted-foreground">
                          <Trans>
                            Unlock with {creditsNeeded.toLocaleString()} more credit
                            {creditsNeeded === 1 ? '' : 's'}
                          </Trans>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {matchedTier && amountInCents !== null ? (
          <div className="mt-4 rounded-lg border border-purple-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  <Trans>Your order</Trans>
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {credits.toLocaleString()} <Trans>credits</Trans>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    {matchedTier.minCredits.toLocaleString()}+ tier ·{' '}
                    {formatZarFromCents(matchedTier.pricePerCreditCents)} / credit
                  </Trans>
                </p>
                <p className="text-xl font-bold text-purple-700">
                  {formatZarFromCents(amountInCents)}
                </p>
              </div>
            </div>
          </div>
        ) : creditsInput ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {nextTier ? (
              <Trans>
                Enter at least {minimumCredits.toLocaleString()} credits. Add{' '}
                {(nextTier.minCredits - credits).toLocaleString()} more to unlock{' '}
                {formatZarFromCents(nextTier.pricePerCreditCents)} per credit.
              </Trans>
            ) : (
              <Trans>
                Enter at least {minimumCredits.toLocaleString()} credits to match a wholesale tier.
              </Trans>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};
