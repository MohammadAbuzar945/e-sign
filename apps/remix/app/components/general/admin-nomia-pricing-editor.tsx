import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@documenso/ui/lib/utils';
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

export type NomiaPricePlanDraft = {
  id: string;
  category: 'PAYG' | 'MONTHLY' | 'ANNUAL';
  name: string;
  credits: number;
  priceInCents: number;
  currency: string;
  paystackPlanCodeTest: string;
  paystackPlanCodeLive: string;
  isEnabled: boolean;
  sortOrder: number;
};

type AdminNomiaPricingEditorProps = {
  category: 'PAYG' | 'MONTHLY' | 'ANNUAL';
  initialPlans: NomiaPricePlanDraft[];
  isLivePaystackEnv: boolean;
  isSaving?: boolean;
  onSave: (plans: NomiaPricePlanDraft[]) => Promise<void> | void;
};

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

export const validateNomiaPricePlanDrafts = (
  plans: NomiaPricePlanDraft[],
  category: NomiaPricePlanDraft['category'],
  isLivePaystackEnv: boolean,
) => {
  for (const plan of plans) {
    if (!plan.name.trim()) {
      return msg`Each plan needs a name.`;
    }

    if (plan.credits < 1) {
      return msg`Each plan needs at least 1 credit.`;
    }

    if (plan.priceInCents < 1) {
      return msg`Each plan needs a price greater than ZAR 0.00.`;
    }

    if (category === 'PAYG') {
      continue;
    }

    if (isLivePaystackEnv && !plan.paystackPlanCodeLive.trim()) {
      return msg`Each plan needs a live Paystack plan code on production.`;
    }

    if (!isLivePaystackEnv && !plan.paystackPlanCodeTest.trim()) {
      return msg`Each plan needs a test Paystack plan code outside production.`;
    }
  }

  return null;
};

const compactInputClassName = 'h-8 px-2 text-xs md:text-xs';
const compactHeadClassName = 'h-9 px-2 text-xs';
const compactCellClassName = 'px-2 py-1.5';

export const AdminNomiaPricingEditor = ({
  category,
  initialPlans,
  isLivePaystackEnv,
  isSaving = false,
  onSave,
}: AdminNomiaPricingEditorProps) => {
  const { _ } = useLingui();
  const [drafts, setDrafts] = useState(initialPlans);
  const [validationError, setValidationError] = useState<string | null>(null);
  const showPaystackPlanCodes = category !== 'PAYG';

  useEffect(() => {
    setDrafts(initialPlans);
    setValidationError(null);
  }, [initialPlans]);

  const categoryPlans = useMemo(
    () => drafts.filter((plan) => plan.category === category).sort((a, b) => a.sortOrder - b.sortOrder),
    [category, drafts],
  );

  const updatePlan = (id: string, patch: Partial<NomiaPricePlanDraft>) => {
    setDrafts((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  };

  const handleSave = async () => {
    const error = validateNomiaPricePlanDrafts(categoryPlans, category, isLivePaystackEnv);

    if (error) {
      setValidationError(_(error));
      return;
    }

    setValidationError(null);
    await onSave(categoryPlans);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table
          overflowHidden
          className={cn(showPaystackPlanCodes && 'table-fixed text-xs')}
        >
          <TableHeader>
            <TableRow>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[16%]' : undefined)}
              >
                <Trans>Pack</Trans>
              </TableHead>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[10%]' : undefined)}
              >
                <Trans>Credits</Trans>
              </TableHead>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[12%]' : undefined)}
              >
                <Trans>Price</Trans>
              </TableHead>
              {showPaystackPlanCodes ? (
                <>
                  <TableHead className={cn(compactHeadClassName, 'w-[26%]')}>
                    {isLivePaystackEnv ? (
                      <Trans>Test code (optional)</Trans>
                    ) : (
                      <Trans>Test code</Trans>
                    )}
                  </TableHead>
                  <TableHead className={cn(compactHeadClassName, 'w-[26%]')}>
                    {isLivePaystackEnv ? (
                      <Trans>Live code</Trans>
                    ) : (
                      <Trans>Live code (optional)</Trans>
                    )}
                  </TableHead>
                </>
              ) : null}
              <TableHead
                className={cn(
                  compactHeadClassName,
                  showPaystackPlanCodes ? 'w-[10%] text-center' : undefined,
                )}
              >
                <Trans>On</Trans>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryPlans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className={compactCellClassName}>
                  <Input
                    className={cn(compactInputClassName, showPaystackPlanCodes ? 'w-full' : 'min-w-[10rem]')}
                    value={plan.name}
                    onChange={(event) => updatePlan(plan.id, { name: event.target.value })}
                  />
                </TableCell>
                <TableCell className={compactCellClassName}>
                  <Input
                    className={cn(compactInputClassName, showPaystackPlanCodes ? 'w-full' : 'w-24')}
                    value={String(plan.credits)}
                    onChange={(event) =>
                      updatePlan(plan.id, { credits: parseCreditsInput(event.target.value) })
                    }
                  />
                </TableCell>
                <TableCell className={compactCellClassName}>
                  <Input
                    className={cn(compactInputClassName, showPaystackPlanCodes ? 'w-full' : 'w-28')}
                    value={centsToZarInput(plan.priceInCents)}
                    onChange={(event) =>
                      updatePlan(plan.id, {
                        priceInCents: parseZarInputToCents(event.target.value),
                      })
                    }
                  />
                </TableCell>
                {showPaystackPlanCodes ? (
                  <>
                    <TableCell className={compactCellClassName}>
                      <Input
                        className={cn(compactInputClassName, 'w-full font-mono')}
                        value={plan.paystackPlanCodeTest}
                        placeholder={isLivePaystackEnv ? 'Optional' : undefined}
                        onChange={(event) =>
                          updatePlan(plan.id, { paystackPlanCodeTest: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className={compactCellClassName}>
                      <Input
                        className={cn(compactInputClassName, 'w-full font-mono')}
                        value={plan.paystackPlanCodeLive}
                        placeholder={isLivePaystackEnv ? undefined : 'Optional'}
                        onChange={(event) =>
                          updatePlan(plan.id, { paystackPlanCodeLive: event.target.value })
                        }
                      />
                    </TableCell>
                  </>
                ) : null}
                <TableCell
                  className={cn(
                    compactCellClassName,
                    showPaystackPlanCodes && 'text-center',
                  )}
                >
                  <Switch
                    className="scale-90"
                    checked={plan.isEnabled}
                    onCheckedChange={(checked) => updatePlan(plan.id, { isEnabled: checked })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}

      <div className="flex justify-end">
        <Button loading={isSaving} onClick={handleSave}>
          <Trans>Save changes</Trans>
        </Button>
      </div>
    </div>
  );
};
