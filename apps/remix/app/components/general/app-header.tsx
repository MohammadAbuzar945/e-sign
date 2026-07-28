import { type HTMLAttributes, useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus, ReadStatus } from '@prisma/client';
import { CoinsIcon, InboxIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { resolveOrganisationBillingPath } from '@documenso/lib/utils/organisation-billing-path';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { getRootHref } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import { BrandingLogo } from '~/components/general/branding-logo';

import { AppCommandMenu } from './app-command-menu';
import { AppNavDesktop } from './app-nav-desktop';
import { AppNavMobile } from './app-nav-mobile';
import { MenuSwitcher } from './menu-switcher';
import { OrgMenuSwitcher } from './org-menu-switcher';

export type HeaderProps = HTMLAttributes<HTMLDivElement>;

export const Header = ({ className, ...props }: HeaderProps) => {
  const params = useParams();

  const { organisations } = useSession();
  const organisation = useOptionalCurrentOrganisation();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const { data: unreadCountData } = trpc.document.inbox.getCount.useQuery(
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

  const { data: pendingInvitesData } = trpc.organisation.member.invite.getMany.useQuery(
    {
      status: OrganisationMemberInviteStatus.PENDING,
    },
    {},
  );

  const { data: billingAttribution } = trpc.organisation.reseller.getBillingAttribution.useQuery(
    {
      organisationId: organisation?.id ?? '',
    },
    {
      enabled: Boolean(organisation?.id),
    },
  );

  const unreadCount = unreadCountData?.count ?? 0;
  const pendingInvitesCount = pendingInvitesData?.length ?? 0;
  const attentionCount = unreadCount + pendingInvitesCount;
  const availableCredits = organisation?.credits ?? 0;
  const hasNegativeCredits = availableCredits < 0;
  const creditsPurchasePath = organisation
    ? resolveOrganisationBillingPath({
        organisationUrl: organisation.url,
        billingAttribution: billingAttribution ?? undefined,
      })
    : null;

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'supports-backdrop-blur:bg-background/60 bg-background/95 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-b-transparent backdrop-blur duration-200',
        scrollY > 5 && 'border-b-border',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-x-4 px-4 md:justify-normal md:px-8">
        <Link
          to={getRootHref(params)}
          className="focus-visible:ring-ring ring-offset-background hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:inline"
        >
          <BrandingLogo className="h-12 w-auto" />
        </Link>

        <AppNavDesktop setIsCommandMenuOpen={setIsCommandMenuOpen} />

        {organisation && creditsPurchasePath && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  className={cn(
                    'hidden h-8 shrink-0 gap-1 rounded-md border px-2 shadow-none md:flex',
                    hasNegativeCredits
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800'
                      : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                  )}
                >
                  <Link to={creditsPurchasePath}>
                    <CoinsIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium tabular-nums">{availableCredits}</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <Trans>Credits available. Click to buy more</Trans>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Button asChild variant="outline" className="relative hidden h-10 w-10 rounded-lg md:flex">
          <Link to="/inbox" className="relative block h-10 w-10">
            <InboxIcon className="text-muted-foreground hover:text-foreground h-5 w-5 flex-shrink-0 transition-colors" />

            {attentionCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold">
                {attentionCount > 99 ? '99+' : attentionCount}
              </span>
            )}
          </Link>
        </Button>

        <div className="md:ml-4">
          {isPersonalLayout(organisations) ? <MenuSwitcher /> : <OrgMenuSwitcher />}
        </div>

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="text-muted-foreground h-6 w-6" />
          </button>

          <button onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="text-muted-foreground h-6 w-6" />
          </button>

          <AppCommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <AppNavMobile
            isMenuOpen={isHamburgerMenuOpen}
            onMenuOpenChange={setIsHamburgerMenuOpen}
          />
        </div>
      </div>
    </header>
  );
};
