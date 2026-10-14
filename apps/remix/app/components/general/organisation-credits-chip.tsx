import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import { CoinsIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { resolveOrganisationBillingPath } from '@documenso/lib/utils/organisation-billing-path';
import { OrganisationType } from '@documenso/prisma/generated/types';
import { trpc } from '@documenso/trpc/react';
import type { TGetOrganisationSessionResponse } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

const findFallbackOrganisation = (
  organisations: TGetOrganisationSessionResponse,
  userId: number,
) => {
  const ownedOrganisations = organisations.filter(
    (organisation) => organisation.ownerUserId === userId,
  );

  const personalOrganisation = ownedOrganisations.find(
    (organisation) => organisation.type === OrganisationType.PERSONAL,
  );

  if (personalOrganisation) {
    return personalOrganisation;
  }

  if (ownedOrganisations.length > 0) {
    return ownedOrganisations[0];
  }

  return organisations[0] ?? null;
};

export type OrganisationCreditsChipProps = HTMLAttributes<HTMLDivElement>;

export const OrganisationCreditsChip = ({ className, ...props }: OrganisationCreditsChipProps) => {
  const { organisations, user } = useSession();
  const currentOrganisation = useOptionalCurrentOrganisation();

  const organisation = currentOrganisation ?? findFallbackOrganisation(organisations, user.id);

  const isOrganisationOwner = organisation?.ownerUserId === user.id;
  const availableCredits = organisation?.credits ?? 0;
  const hasNegativeCredits = availableCredits < 0;
  const hasZeroCredits = availableCredits === 0;

  const { data: billingAttribution } = trpc.organisation.reseller.getBillingAttribution.useQuery(
    {
      organisationId: organisation?.id ?? '',
    },
    {
      enabled: Boolean(organisation?.id),
    },
  );

  if (!organisation) {
    return null;
  }

  const creditsPurchasePath = resolveOrganisationBillingPath({
    organisationUrl: organisation.url,
    billingAttribution: billingAttribution ?? undefined,
  });

  const chipClassName = cn(
    'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2',
    hasNegativeCredits
      ? 'border-yellow-300 bg-yellow-100 text-yellow-800'
      : hasZeroCredits
        ? 'border-red-300 bg-red-100 text-red-700'
        : 'border-primary/20 bg-primary/10 text-primary',
    className,
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {isOrganisationOwner ? (
            <Button
              asChild
              variant="outline"
              className={cn(
                chipClassName,
                'shadow-none',
                hasNegativeCredits
                  ? 'hover:bg-yellow-200 hover:text-yellow-900'
                  : hasZeroCredits
                    ? 'hover:bg-red-200 hover:text-red-800'
                    : 'hover:bg-primary/15 hover:text-primary',
              )}
            >
              <Link to={creditsPurchasePath}>
                <CoinsIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium tabular-nums">{availableCredits}</span>
              </Link>
            </Button>
          ) : (
            <div className={cn(chipClassName, 'cursor-default')} {...props}>
              <CoinsIcon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-xs font-medium tabular-nums">{availableCredits}</span>
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isOrganisationOwner ? (
            hasZeroCredits || hasNegativeCredits ? (
              <Trans>{organisation.name} credits unavailable. Click to buy more</Trans>
            ) : (
              <Trans>{organisation.name} credits available. Click to buy more</Trans>
            )
          ) : hasZeroCredits || hasNegativeCredits ? (
            <Trans>{organisation.name} credits unavailable</Trans>
          ) : (
            <Trans>{organisation.name} credits available</Trans>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
