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

const formatZar = (value: number, decimals = 2) => {
  if (!Number.isFinite(value) || value <= 0) {
    return (0).toFixed(decimals);
  }

  return value.toFixed(decimals);
};

const centsToZarInput = (cents: number) => formatZar(cents / 100, 2);

const perCreditZarFromPlan = (credits: number, priceInCents: number) => {
  if (credits < 1 || priceInCents < 1) {
    return 0;
  }

  return priceInCents / credits / 100;
};

const formatPerCreditZarInput = (credits: number, priceInCents: number) =>
  formatZar(perCreditZarFromPlan(credits, priceInCents), 2);

const parseZarNumber = (value: string) => {
  const trimmed = value.trim().replace(',', '.');

  if (!trimmed || trimmed === '.' || trimmed === '-') {
    return 0;
  }

  const parsed = Number.parseFloat(trimmed);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
};

const parseZarInputToCents = (value: string) => Math.round(parseZarNumber(value) * 100);

const isValidZarDraftInput = (value: string, maxDecimals: number) =>
  new RegExp(`^\\d*(?:[.,]\\d{0,${maxDecimals}})?$`).test(value.trim());

const parseCreditsInput = (value: string) => {
  const normalized = value.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
};

const totalCentsFromPerCredit = (perCreditZar: number, credits: number) => {
  if (perCreditZar <= 0 || credits < 1) {
    return 0;
  }

  return Math.round(perCreditZar * 100 * credits);
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
      return msg`Each plan needs a total price greater than ZAR 0.00.`;
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
  const [perCreditInputs, setPerCreditInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialPlans.map((plan) => [plan.id, formatPerCreditZarInput(plan.credits, plan.priceInCents)]),
    ),
  );
  const [totalInputs, setTotalInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPlans.map((plan) => [plan.id, centsToZarInput(plan.priceInCents)])),
  );
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPlans.map((plan) => [plan.id, String(plan.credits || '')])),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const showPaystackPlanCodes = category !== 'PAYG';

  const initialPlansKey = useMemo(() => JSON.stringify(initialPlans), [initialPlans]);

  useEffect(() => {
    if (isSaving) {
      return;
    }

    const nextPlans = JSON.parse(initialPlansKey) as NomiaPricePlanDraft[];
    setDrafts(nextPlans);
    setPerCreditInputs(
      Object.fromEntries(
        nextPlans.map((plan) => [plan.id, formatPerCreditZarInput(plan.credits, plan.priceInCents)]),
      ),
    );
    setTotalInputs(
      Object.fromEntries(nextPlans.map((plan) => [plan.id, centsToZarInput(plan.priceInCents)])),
    );
    setCreditInputs(
      Object.fromEntries(nextPlans.map((plan) => [plan.id, String(plan.credits || '')])),
    );
    setValidationError(null);
  }, [initialPlansKey, isSaving]);

  const categoryPlans = useMemo(
    () => drafts.filter((plan) => plan.category === category).sort((a, b) => a.sortOrder - b.sortOrder),
    [category, drafts],
  );

  const updatePlan = (id: string, patch: Partial<NomiaPricePlanDraft>) => {
    setDrafts((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  };

  const syncPriceInputs = (id: string, credits: number, priceInCents: number) => {
    setPerCreditInputs((current) => ({
      ...current,
      [id]: formatPerCreditZarInput(credits, priceInCents),
    }));
    setTotalInputs((current) => ({
      ...current,
      [id]: centsToZarInput(priceInCents),
    }));
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
        <Table overflowHidden className={cn(showPaystackPlanCodes && 'table-fixed text-xs')}>
          <TableHeader>
            <TableRow>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[14%]' : undefined)}
              >
                <Trans>Pack</Trans>
              </TableHead>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[9%]' : undefined)}
              >
                <Trans>Credits</Trans>
              </TableHead>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[11%]' : undefined)}
              >
                <Trans>Per credit</Trans>
              </TableHead>
              <TableHead
                className={cn(compactHeadClassName, showPaystackPlanCodes ? 'w-[11%]' : undefined)}
              >
                <Trans>Total</Trans>
              </TableHead>
              {showPaystackPlanCodes ? (
                <>
                  <TableHead className={cn(compactHeadClassName, 'w-[22%]')}>
                    {isLivePaystackEnv ? (
                      <Trans>Test code (optional)</Trans>
                    ) : (
                      <Trans>Test code</Trans>
                    )}
                  </TableHead>
                  <TableHead className={cn(compactHeadClassName, 'w-[22%]')}>
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
                  showPaystackPlanCodes ? 'w-[11%] text-center' : undefined,
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
                    className={cn(
                      compactInputClassName,
                      showPaystackPlanCodes ? 'w-full' : 'min-w-[10rem]',
                    )}
                    value={plan.name}
                    onChange={(event) => updatePlan(plan.id, { name: event.target.value })}
                  />
                </TableCell>
                <TableCell className={compactCellClassName}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className={cn(compactInputClassName, showPaystackPlanCodes ? 'w-full' : 'w-24')}
                    value={creditInputs[plan.id] ?? String(plan.credits || '')}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^\d]/g, '');
                      const credits = parseCreditsInput(value);
                      const perCreditZar =
                        parseZarNumber(perCreditInputs[plan.id] ?? '') ||
                        perCreditZarFromPlan(plan.credits, plan.priceInCents);
                      const priceInCents = totalCentsFromPerCredit(perCreditZar, credits);

                      setCreditInputs((current) => ({ ...current, [plan.id]: value }));
                      updatePlan(plan.id, { credits, priceInCents });
                      setTotalInputs((current) => ({
                        ...current,
                        [plan.id]: centsToZarInput(priceInCents),
                      }));
                    }}
                    onBlur={() => {
                      setCreditInputs((current) => ({
                        ...current,
                        [plan.id]: plan.credits > 0 ? String(plan.credits) : '',
                      }));
                      syncPriceInputs(plan.id, plan.credits, plan.priceInCents);
                    }}
                  />
                </TableCell>
                <TableCell className={compactCellClassName}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className={cn(
                      compactInputClassName,
                      'tabular-nums',
                      showPaystackPlanCodes ? 'w-full' : 'w-28',
                    )}
                    value={
                      perCreditInputs[plan.id] ??
                      formatPerCreditZarInput(plan.credits, plan.priceInCents)
                    }
                    onChange={(event) => {
                      const value = event.target.value;

                      if (!isValidZarDraftInput(value, 2)) {
                        return;
                      }

                      const perCreditZar = parseZarNumber(value);
                      const priceInCents = totalCentsFromPerCredit(perCreditZar, plan.credits);

                      setPerCreditInputs((current) => ({ ...current, [plan.id]: value }));
                      updatePlan(plan.id, { priceInCents });
                      setTotalInputs((current) => ({
                        ...current,
                        [plan.id]: centsToZarInput(priceInCents),
                      }));
                    }}
                    onBlur={() => {
                      syncPriceInputs(plan.id, plan.credits, plan.priceInCents);
                    }}
                  />
                </TableCell>
                <TableCell className={compactCellClassName}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className={cn(
                      compactInputClassName,
                      'tabular-nums',
                      showPaystackPlanCodes ? 'w-full' : 'w-28',
                    )}
                    value={totalInputs[plan.id] ?? centsToZarInput(plan.priceInCents)}
                    onChange={(event) => {
                      const value = event.target.value;

                      if (!isValidZarDraftInput(value, 2)) {
                        return;
                      }

                      const priceInCents = parseZarInputToCents(value);

                      setTotalInputs((current) => ({ ...current, [plan.id]: value }));
                      updatePlan(plan.id, { priceInCents });
                      setPerCreditInputs((current) => ({
                        ...current,
                        [plan.id]: formatPerCreditZarInput(plan.credits, priceInCents),
                      }));
                    }}
                    onBlur={() => {
                      syncPriceInputs(plan.id, plan.credits, plan.priceInCents);
                    }}
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
                  className={cn(compactCellClassName, showPaystackPlanCodes && 'text-center')}
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
