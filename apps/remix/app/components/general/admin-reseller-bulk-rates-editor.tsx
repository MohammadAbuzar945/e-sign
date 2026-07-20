import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { MAX_RESELLER_BULK_RATE_TIERS } from '@documenso/lib/constants/reseller-bulk-rates';

import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Switch } from '@documenso/ui/primitives/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

export type BulkRateTierDraft = {
  minCredits: number;
  pricePerCreditCents: number;
  isEnabled: boolean;
};

type AdminResellerBulkRatesEditorProps = {
  initialTiers: BulkRateTierDraft[];
  isSaving?: boolean;
  onSave: (tiers: BulkRateTierDraft[]) => Promise<void> | void;
  showEnabledToggle?: boolean;
  showFooter?: boolean;
  showHelperText?: boolean;
  showAddTier?: boolean;
  formId?: string;
};

const emptyTier = (): BulkRateTierDraft => ({
  minCredits: 500,
  pricePerCreditCents: 600,
  isEnabled: true,
});

const formatZarFromCents = (cents: number) => `ZAR ${(cents / 100).toFixed(2)}`;

const centsToZarInput = (cents: number) => (cents / 100).toFixed(2);

const parseZarInputToCents = (value: string) => {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed * 100);
};

const parseCreditsInput = (value: string) => {
  const normalized = value.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
};

const sortTiers = (tiers: BulkRateTierDraft[]) =>
  [...tiers].sort((a, b) => a.minCredits - b.minCredits);

export const formatBulkRateTierSummary = (tiers: BulkRateTierDraft[]) => {
  const enabledTiers = sortTiers(tiers).filter((tier) => tier.isEnabled);

  if (enabledTiers.length === 0) {
    return null;
  }

  const lowestRate = Math.min(...enabledTiers.map((tier) => tier.pricePerCreditCents));

  return {
    tierCount: enabledTiers.length,
    lowestRateCents: lowestRate,
    tiers: enabledTiers,
  };
};

export const validateBulkRateTiers = (tiers: BulkRateTierDraft[]) => {
  const enabledTiers = tiers.filter((tier) => tier.isEnabled);

  if (enabledTiers.length === 0) {
    return msg`Add at least one active tier.`;
  }

  for (const tier of tiers) {
    if (tier.minCredits < 1) {
      return msg`Each tier needs a minimum credit amount of at least 1.`;
    }

    if (tier.pricePerCreditCents < 1) {
      return msg`Each tier needs a rate greater than ZAR 0.00.`;
    }
  }

  const minCreditsValues = tiers.map((tier) => tier.minCredits);
  const uniqueMinCredits = new Set(minCreditsValues);

  if (uniqueMinCredits.size !== minCreditsValues.length) {
    return msg`Each tier must have a unique minimum credit amount.`;
  }

  if (tiers.length > MAX_RESELLER_BULK_RATE_TIERS) {
    return msg`A maximum of ${MAX_RESELLER_BULK_RATE_TIERS} tiers is allowed.`;
  }

  return null;
};

export const AdminResellerBulkRatesEditor = ({
  initialTiers,
  isSaving = false,
  onSave,
  showEnabledToggle = true,
  showFooter = true,
  showHelperText = true,
  showAddTier,
  formId,
}: AdminResellerBulkRatesEditorProps) => {
  const { _ } = useLingui();
  const generatedFormId = useId();
  const resolvedFormId = formId ?? generatedFormId;

  const [tiers, setTiers] = useState<BulkRateTierDraft[]>(
    initialTiers.length > 0 ? sortTiers(initialTiers) : [emptyTier()],
  );
  const [zarInputs, setZarInputs] = useState<Record<number, string>>({});
  const [creditInputs, setCreditInputs] = useState<Record<number, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const nextTiers = initialTiers.length > 0 ? sortTiers(initialTiers) : [emptyTier()];
    setTiers(nextTiers);
    setZarInputs(
      Object.fromEntries(
        nextTiers.map((tier, index) => [index, centsToZarInput(tier.pricePerCreditCents)]),
      ),
    );
    setCreditInputs(
      Object.fromEntries(nextTiers.map((tier, index) => [index, String(tier.minCredits || '')])),
    );
    setValidationError(null);
  }, [initialTiers]);

  const previewTiers = useMemo(() => sortTiers(tiers).filter((tier) => tier.isEnabled), [tiers]);

  const updateTier = (index: number, patch: Partial<BulkRateTierDraft>) => {
    const next = [...tiers];
    next[index] = { ...next[index], ...patch };
    setTiers(next);
    setValidationError(null);
  };

  const handleSubmit = async () => {
    const sortedTiers = sortTiers(tiers);
    const errorMessage = validateBulkRateTiers(sortedTiers);

    if (errorMessage) {
      setValidationError(_(errorMessage));
      return;
    }

    setValidationError(null);
    await onSave(sortedTiers);
  };

  const shouldShowAddTier = showAddTier ?? showFooter;
  const canAddTier = tiers.length < MAX_RESELLER_BULK_RATE_TIERS;

  const handleAddTier = () => {
    if (!canAddTier) {
      return;
    }

    const nextTiers = [...tiers, emptyTier()];
    setTiers(nextTiers);
    setZarInputs((current) => ({
      ...current,
      [nextTiers.length - 1]: centsToZarInput(emptyTier().pricePerCreditCents),
    }));
    setCreditInputs((current) => ({
      ...current,
      [nextTiers.length - 1]: String(emptyTier().minCredits),
    }));
  };

  return (
    <form
      id={resolvedFormId}
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await handleSubmit();
      }}
    >
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            <Trans>
              {tiers.length} / {MAX_RESELLER_BULK_RATE_TIERS} tiers
            </Trans>
          </span>
          {!canAddTier ? (
            <span>
              <Trans>Maximum tiers reached</Trans>
            </span>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">
                <Trans>Min credits</Trans>
              </TableHead>
              <TableHead className="min-w-[120px]">
                <Trans>Rate (ZAR)</Trans>
              </TableHead>
              <TableHead className="min-w-[180px]">
                <Trans>Total at minimum</Trans>
              </TableHead>
              {showEnabledToggle ? (
                <TableHead className="w-[72px] text-center">
                  <Trans>On</Trans>
                </TableHead>
              ) : null}
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier, index) => {
              const orderTotalCents =
                tier.minCredits > 0 && tier.pricePerCreditCents > 0
                  ? tier.minCredits * tier.pricePerCreditCents
                  : null;

              return (
                <TableRow key={`tier-row-${index}`}>
                  <TableCell className="align-top">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="h-9 tabular-nums"
                      value={creditInputs[index] ?? String(tier.minCredits || '')}
                      placeholder="500"
                      onChange={(event) => {
                        const value = event.target.value;
                        setCreditInputs((current) => ({ ...current, [index]: value }));
                        updateTier(index, {
                          minCredits: parseCreditsInput(value),
                        });
                      }}
                      onBlur={() => {
                        setCreditInputs((current) => ({
                          ...current,
                          [index]: tier.minCredits > 0 ? String(tier.minCredits) : '',
                        }));
                      }}
                    />
                  </TableCell>

                  <TableCell className="align-top">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-9 tabular-nums"
                      value={zarInputs[index] ?? centsToZarInput(tier.pricePerCreditCents)}
                      placeholder="6.00"
                      onChange={(event) => {
                        const value = event.target.value;
                        setZarInputs((current) => ({ ...current, [index]: value }));
                        updateTier(index, {
                          pricePerCreditCents: parseZarInputToCents(value),
                        });
                      }}
                      onBlur={() => {
                        setZarInputs((current) => ({
                          ...current,
                          [index]: centsToZarInput(tier.pricePerCreditCents),
                        }));
                      }}
                    />
                  </TableCell>

                  <TableCell className="align-top">
                    <p className="pt-2 text-sm">
                      {orderTotalCents !== null ? (
                        <>
                          <span className="font-medium">{formatZarFromCents(orderTotalCents)}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {tier.minCredits.toLocaleString()} ×{' '}
                            {formatZarFromCents(tier.pricePerCreditCents)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </TableCell>

                  {showEnabledToggle ? (
                    <TableCell className="align-top">
                      <div className="flex justify-center pt-1">
                        <Switch
                          checked={tier.isEnabled}
                          onCheckedChange={(checked) => {
                            updateTier(index, { isEnabled: checked });
                          }}
                        />
                      </div>
                    </TableCell>
                  ) : null}

                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-0.5 text-muted-foreground hover:text-destructive"
                      disabled={tiers.length <= 1}
                      onClick={() => {
                        const nextTiers = tiers.filter((_, itemIndex) => itemIndex !== index);
                        setTiers(nextTiers);
                        setZarInputs(
                          Object.fromEntries(
                            nextTiers.map((nextTier, nextIndex) => [
                              nextIndex,
                              centsToZarInput(nextTier.pricePerCreditCents),
                            ]),
                          ),
                        );
                        setCreditInputs(
                          Object.fromEntries(
                            nextTiers.map((nextTier, nextIndex) => [
                              nextIndex,
                              String(nextTier.minCredits),
                            ]),
                          ),
                        );
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {validationError ? (
        <p className="text-sm text-destructive">{validationError}</p>
      ) : null}

      {showHelperText && previewTiers.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>
            Orders use the best matching tier by quantity. Example: 2,000 credits at{' '}
            {formatZarFromCents(
              [...previewTiers]
                .reverse()
                .find((tier) => 2000 >= tier.minCredits)?.pricePerCreditCents ??
                previewTiers[0].pricePerCreditCents,
            )}{' '}
            per credit.
          </Trans>
        </p>
      ) : null}

      {shouldShowAddTier && !showFooter ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAddTier}
          onClick={handleAddTier}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          <Trans>Add tier</Trans>
        </Button>
      ) : null}

      {showFooter ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAddTier}
            onClick={handleAddTier}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            <Trans>Add tier</Trans>
          </Button>

          <Button type="submit" loading={isSaving}>
            <Trans>Save rates</Trans>
          </Button>
        </div>
      ) : null}
    </form>
  );
};
