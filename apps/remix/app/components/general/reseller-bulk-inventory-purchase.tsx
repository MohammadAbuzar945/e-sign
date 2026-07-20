import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo, useState } from 'react';

import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
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

  const credits = Number(creditsInput);
  const matchedTier = useMemo(() => {
    if (!rates?.tiers.length || !Number.isFinite(credits) || credits <= 0) {
      return null;
    }

    const sorted = [...rates.tiers].sort((a, b) => a.minCredits - b.minCredits);
    const match = [...sorted].reverse().find((tier) => credits >= tier.minCredits);

    return match ?? null;
  }, [credits, rates?.tiers]);

  const amountInCents =
    matchedTier && Number.isInteger(credits) ? credits * matchedTier.pricePerCreditCents : null;

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <Trans>Loading bulk rates…</Trans>
      </div>
    );
  }

  if (!rates || rates.tiers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-emerald-900">
            <Trans>Bulk inventory</Trans>
          </h2>
          <p className="mt-1 text-sm text-emerald-800/80">
            <Trans>
              Buy credits in volume at wholesale rates for your reseller stock. Retail packages below
              stay available for normal top-ups.
            </Trans>
          </p>
        </div>
        <Badge variant={rates.source === 'CUSTOM' ? 'default' : 'neutral'}>
          {rates.source === 'CUSTOM' ? (
            <Trans>Custom rates</Trans>
          ) : (
            <Trans>Standard Nomia rates</Trans>
          )}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Trans>Min credits</Trans>
              </TableHead>
              <TableHead>
                <Trans>Rate / credit</Trans>
              </TableHead>
              <TableHead>
                <Trans>Example total</Trans>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.tiers.map((tier) => (
              <TableRow key={tier.minCredits}>
                <TableCell>{tier.minCredits.toLocaleString()}+</TableCell>
                <TableCell>{formatZarFromCents(tier.pricePerCreditCents)}</TableCell>
                <TableCell>
                  {formatZarFromCents(tier.minCredits * tier.pricePerCreditCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="bulk-credits">
            <Trans>Credits to buy</Trans>
          </Label>
          <Input
            id="bulk-credits"
            type="number"
            min={rates.tiers[0]?.minCredits ?? 1}
            step={1}
            value={creditsInput}
            placeholder={String(rates.tiers[0]?.minCredits ?? 500)}
            onChange={(event) => {
              setCreditsInput(event.target.value);
            }}
          />
          {matchedTier && amountInCents !== null ? (
            <p className="text-sm text-emerald-900">
              <Trans>
                {credits.toLocaleString()} credits × {formatZarFromCents(matchedTier.pricePerCreditCents)}{' '}
                = {formatZarFromCents(amountInCents)}
              </Trans>
            </p>
          ) : creditsInput ? (
            <p className="text-sm text-amber-700">
              <Trans>
                Enter at least {rates.tiers[0]?.minCredits.toLocaleString()} credits to match a rate
                tier.
              </Trans>
            </p>
          ) : null}
        </div>

        <Button
          loading={isPending}
          disabled={!matchedTier || amountInCents === null}
          onClick={async () => {
            await initializeBulkPurchase({
              organisationId,
              credits,
            });
          }}
        >
          <Trans>Buy bulk</Trans>
        </Button>
      </div>
    </div>
  );
};
