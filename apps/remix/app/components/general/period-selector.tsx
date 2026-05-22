import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import { Button } from '@documenso/ui/primitives/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

const isPeriodSelectorValue = (value: unknown): value is PeriodSelectorValue => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ['', '7d', '14d', '30d'].includes(value as string);
};

const PeriodSelectorFallback = ({ period }: { period: PeriodSelectorValue | 'all' }) => {
  return (
    <Button
      variant="outline"
      role="combobox"
      disabled
      className="max-w-[200px] text-muted-foreground"
      aria-expanded={false}
    >
      <span className="truncate">
        {period === '7d' ? (
          <Trans>Last 7 days</Trans>
        ) : period === '14d' ? (
          <Trans>Last 14 days</Trans>
        ) : period === '30d' ? (
          <Trans>Last 30 days</Trans>
        ) : (
          <Trans>All Time</Trans>
        )}
      </span>
    </Button>
  );
};

export const PeriodSelector = () => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();
  const isMounted = useIsMounted();

  const period = useMemo(() => {
    const p = searchParams?.get('period') ?? 'all';

    return isPeriodSelectorValue(p) ? p : 'all';
  }, [searchParams]);

  const onPeriodChange = (newPeriod: string) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('period', newPeriod);

    if (newPeriod === '' || newPeriod === 'all') {
      params.delete('period');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  if (!isMounted) {
    return <PeriodSelectorFallback period={period} />;
  }

  return (
    <Select defaultValue={period} onValueChange={onPeriodChange}>
      <SelectTrigger className="max-w-[200px] text-muted-foreground">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
        <SelectItem value="all">
          <Trans>All Time</Trans>
        </SelectItem>
        <SelectItem value="7d">
          <Trans>Last 7 days</Trans>
        </SelectItem>
        <SelectItem value="14d">
          <Trans>Last 14 days</Trans>
        </SelectItem>
        <SelectItem value="30d">
          <Trans>Last 30 days</Trans>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
