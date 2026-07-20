import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

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
};

const emptyTier = (): BulkRateTierDraft => ({
  minCredits: 500,
  pricePerCreditCents: 600,
  isEnabled: true,
});

export const AdminResellerBulkRatesEditor = ({
  initialTiers,
  isSaving = false,
  onSave,
  showEnabledToggle = true,
}: AdminResellerBulkRatesEditorProps) => {
  const { _ } = useLingui();
  const [tiers, setTiers] = useState<BulkRateTierDraft[]>(
    initialTiers.length > 0 ? initialTiers : [emptyTier()],
  );

  useEffect(() => {
    setTiers(initialTiers.length > 0 ? initialTiers : [emptyTier()]);
  }, [initialTiers]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {tiers.map((tier, index) => (
          <div
            key={`${tier.minCredits}-${index}`}
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
          >
            <div className="space-y-1">
              <Label>
                <Trans>Min credits</Trans>
              </Label>
              <Input
                type="number"
                min={1}
                value={tier.minCredits}
                onChange={(event) => {
                  const next = [...tiers];
                  next[index] = {
                    ...tier,
                    minCredits: Number(event.target.value) || 0,
                  };
                  setTiers(next);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label>
                <Trans>Price per credit (cents)</Trans>
              </Label>
              <Input
                type="number"
                min={1}
                value={tier.pricePerCreditCents}
                onChange={(event) => {
                  const next = [...tiers];
                  next[index] = {
                    ...tier,
                    pricePerCreditCents: Number(event.target.value) || 0,
                  };
                  setTiers(next);
                }}
              />
              <p className="text-xs text-muted-foreground">
                ZAR {(tier.pricePerCreditCents / 100).toFixed(2)} / credit
              </p>
            </div>

            {showEnabledToggle ? (
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={tier.isEnabled}
                  onCheckedChange={(checked) => {
                    const next = [...tiers];
                    next[index] = { ...tier, isEnabled: checked };
                    setTiers(next);
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  <Trans>Enabled</Trans>
                </span>
              </div>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={tiers.length <= 1}
              onClick={() => {
                setTiers(tiers.filter((_, itemIndex) => itemIndex !== index));
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTiers([...tiers, emptyTier()]);
          }}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          <Trans>Add tier</Trans>
        </Button>

        <Button
          type="button"
          loading={isSaving}
          onClick={async () => {
            await onSave(tiers);
          }}
        >
          <Trans>Save rates</Trans>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {_(
          msg`Quantity uses the highest matching min-credits tier. Example: 2,000 credits at R6.00/credit = R12,000.`,
        )}
      </p>
    </div>
  );
};
