import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  Building2Icon,
  ChevronsUpDown,
  CreditCardIcon,
  Plus,
  Settings2Icon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { EXTENDED_TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { OrganisationMemberRole, OrganisationType } from '@documenso/prisma/generated/types';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { LanguageSwitcherDialog } from '@documenso/ui/components/common/language-switcher-dialog';
import { cn } from '@documenso/ui/lib/utils';
import { useHydrated } from '@documenso/ui/lib/use-hydrated';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { useOptionalCurrentTeam } from '~/providers/team';

import { OrganisationCreateDialog } from '../dialogs/organisation-create-dialog';

export const OrgMenuSwitcher = () => {
  const { _ } = useLingui();
  const isHydrated = useHydrated();

  const { user, organisations } = useSession();

  const { pathname } = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);
  const [hoveredOrgId, setHoveredOrgId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const isUserAdmin = isAdmin(user);

  const isOrganisationOwner = organisations.some((org) => org.ownerUserId === user.id);

  const ownedOrganisationsCount = organisations.filter((org) => org.ownerUserId === user.id).length;
  const rawMax = user.maxOrganisationCount as number | string | undefined;
  const numMax = typeof rawMax === 'number' ? rawMax : Number(rawMax);
  const maxOrganisationCount =
    !Number.isNaN(numMax) && numMax >= 0 ? numMax : 1;

  // Check if user can create more organisations
  // If maxOrganisationCount is 0, it means unlimited (only for admins)
  const canCreateOrganisation =
    (maxOrganisationCount === 0 && isUserAdmin) ||
    (maxOrganisationCount > 0 && ownedOrganisationsCount < maxOrganisationCount);

  const handleCreateOrganisationClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (canCreateOrganisation) {
      setCreateDialogOpen(true);
      setIsOpen(false);
    } else {
      setContactModalOpen(true);
    }
  };

  const sortedOrganisations = useMemo(
    () => {
      const personalOwnerOrganisations = organisations.filter(
        (org) => org.ownerUserId === user.id && org.type === OrganisationType.PERSONAL,
      );

      const otherOrganisations = organisations.filter(
        (org) => !(org.ownerUserId === user.id && org.type === OrganisationType.PERSONAL),
      );

      return [...personalOwnerOrganisations, ...otherOrganisations];
    },
    [organisations, user.id],
  );

  const isPathOrgUrl = (orgUrl: string) => {
    if (!pathname || !pathname.startsWith(`/o/`)) {
      return false;
    }

    return pathname.split('/')[2] === orgUrl;
  };

  const selectedOrg = organisations.find((org) => isPathOrgUrl(org.url));
  const hoveredOrg = organisations.find(
    (org) => org.id === hoveredOrgId || organisations.length === 1,
  );

  const currentOrganisation = useOptionalCurrentOrganisation();
  const currentTeam = useOptionalCurrentTeam();

  // Use hovered org for teams display if available,
  // otherwise use current team's org if in a team,
  // finally fallback to selected org
  const displayedOrg = hoveredOrg || currentOrganisation || selectedOrg;

  const formatAvatarFallback = (name?: string) => {
    if (name !== undefined) {
      return name.slice(0, 1).toUpperCase();
    }

    return user.name ? extractInitials(user.name) : user.email.slice(0, 1).toUpperCase();
  };

  const dropdownMenuAvatarText = useMemo(() => {
    if (currentTeam) {
      return {
        avatarSrc: formatAvatarUrl(currentTeam.avatarImageId),
        avatarFallback: formatAvatarFallback(currentTeam.name),
        primaryText: currentTeam.name,
        secondaryText: _(EXTENDED_TEAM_MEMBER_ROLE_MAP[currentTeam.currentTeamRole]),
      };
    }

    if (currentOrganisation) {
      return {
        avatarSrc: formatAvatarUrl(currentOrganisation.avatarImageId),
        avatarFallback: formatAvatarFallback(currentOrganisation.name),
        primaryText: currentOrganisation.name,
        secondaryText: _(
          EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[currentOrganisation.currentOrganisationRole],
        ),
      };
    }

    return {
      avatarSrc: formatAvatarUrl(user.avatarImageId),
      avatarFallback: formatAvatarFallback(user.name ?? user.email),
      primaryText: user.name,
      secondaryText: _(msg`Personal Account`),
    };
  }, [currentTeam, currentOrganisation, user]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setHoveredOrgId(currentOrganisation?.id || null);
    }

    setIsOpen(open);
  };

  if (!isHydrated) {
    return (
      <Button
        data-testid="menu-switcher"
        variant="none"
        className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
      >
        <AvatarWithText
          avatarSrc={dropdownMenuAvatarText.avatarSrc}
          avatarFallback={dropdownMenuAvatarText.avatarFallback}
          primaryText={dropdownMenuAvatarText.primaryText}
          secondaryText={dropdownMenuAvatarText.secondaryText}
          rightSideComponent={<ChevronsUpDown className="text-muted-foreground ml-auto h-4 w-4" />}
          textSectionClassName="hidden lg:flex"
        />
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="menu-switcher"
          variant="none"
          className="relative flex h-12 flex-row items-center px-0 py-2 ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent md:px-2"
        >
          <AvatarWithText
            avatarSrc={dropdownMenuAvatarText.avatarSrc}
            avatarFallback={dropdownMenuAvatarText.avatarFallback}
            primaryText={dropdownMenuAvatarText.primaryText}
            secondaryText={dropdownMenuAvatarText.secondaryText}
            rightSideComponent={
              <ChevronsUpDown className="text-muted-foreground ml-auto h-4 w-4" />
            }
            textSectionClassName="hidden lg:flex"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={cn(
          'divide-border z-[60] ml-6 flex w-full divide-x p-0 md:ml-0 md:min-w-[40rem]',
        )}
        align="end"
        forceMount
      >
        <div className="flex h-[400px] w-full divide-x">
          {/* Organisations column */}
          <div className="flex w-full flex-col md:w-1/3">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <Building2Icon className="mr-2 h-3.5 w-3.5" />
                <Trans>Organisations</Trans>
              </h3>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              {sortedOrganisations.map((org) => (
                <div
                  className="group relative"
                  key={org.id}
                  onMouseEnter={() => setHoveredOrgId(org.id)}
                >
                  <DropdownMenuItem
                    className={cn(
                      'text-muted-foreground w-full px-4 py-2',
                      org.id === currentOrganisation?.id && !hoveredOrgId && 'bg-accent',
                      org.id === hoveredOrgId && 'bg-accent',
                    )}
                    asChild
                  >
                    <Link to={`/o/${org.url}`} className="flex items-center space-x-2 pr-8">
                      <span
                        className={cn('min-w-0 flex-1 truncate', {
                          'font-semibold': org.id === selectedOrg?.id,
                        })}
                      >
                        {org.name}
                      </span>
                    </Link>
                  </DropdownMenuItem>

                  {canExecuteOrganisationAction(
                    'MANAGE_ORGANISATION',
                    org.currentOrganisationRole,
                  ) && (
                    <div className="absolute bottom-0 right-0 top-0 flex items-center justify-center">
                      <Link
                        to={`/o/${org.url}/settings`}
                        className="text-muted-foreground mr-2 rounded-sm border p-1 transition-opacity duration-200 group-hover:opacity-100 md:opacity-0"
                      >
                        <Settings2Icon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={handleCreateOrganisationClick}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Plus className="mr-2 h-4 w-4" />
                <Trans>Create Organisation</Trans>
              </Button>
            </div>
          </div>

          {/* Teams column */}
          <div className="hidden w-1/3 flex-col md:flex">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <UsersIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Teams</Trans>
              </h3>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              <AnimateGenericFadeInOut key={displayedOrg ? 'displayed-org' : 'no-org'}>
                {hoveredOrg ? (
                  hoveredOrg.teams.map((team) => (
                    <div className="group relative" key={team.id}>
                      <DropdownMenuItem
                        className={cn(
                          'text-muted-foreground w-full px-4 py-2',
                          team.id === currentTeam?.id && 'bg-accent',
                        )}
                        asChild
                      >
                        <Link to={`/t/${team.url}`} className="flex items-center space-x-2 pr-8">
                          <span
                            className={cn('min-w-0 flex-1 truncate', {
                              'font-semibold': team.id === currentTeam?.id,
                            })}
                          >
                            {team.name}
                          </span>
                        </Link>
                      </DropdownMenuItem>

                      {canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole) && (
                        <div className="absolute bottom-0 right-0 top-0 flex items-center justify-center">
                          <Link
                            to={`/t/${team.url}/settings`}
                            className="text-muted-foreground mr-2 rounded-sm border p-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          >
                            <Settings2Icon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground my-12 flex items-center justify-center px-2 text-center text-sm">
                    <Trans>Select an organisation to view teams</Trans>
                  </div>
                )}

                {displayedOrg &&
                  (displayedOrg.ownerUserId === user.id ||
                    displayedOrg.currentOrganisationRole === OrganisationMemberRole.ADMIN ||
                    displayedOrg.currentOrganisationRole === OrganisationMemberRole.MANAGER) && (
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to={`/o/${displayedOrg.url}/settings/teams?action=add-team`}>
                        <Plus className="mr-2 h-4 w-4" />
                        <Trans>Create Team</Trans>
                      </Link>
                    </Button>
                  )}
              </AnimateGenericFadeInOut>
            </div>
          </div>

          {/* Settings column */}
          <div className="hidden w-1/3 flex-col md:flex">
            <div className="flex h-12 items-center border-b p-2">
              <h3 className="text-muted-foreground flex items-center px-2 text-sm font-medium">
                <SettingsIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Settings</Trans>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {isUserAdmin && (
                <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                  <Link to="/admin">
                    <Trans>Admin panel</Trans>
                  </Link>
                </DropdownMenuItem>
              )}

              {currentOrganisation &&
                currentOrganisation.type !== OrganisationType.PERSONAL &&
                canExecuteOrganisationAction(
                  'MANAGE_ORGANISATION',
                  currentOrganisation.currentOrganisationRole,
                ) && (
                  <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                    <Link to={`/o/${currentOrganisation.url}/settings`}>
                      <Trans>Organisation settings</Trans>
                    </Link>
                  </DropdownMenuItem>
                )}

              <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                <Link to="/inbox">
                  <Trans>Personal Inbox</Trans>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                <Link to="/settings/profile">
                  <Trans>Account</Trans>
                </Link>
              </DropdownMenuItem>

              {/* {isOrganisationOwner && (
                <DropdownMenuItem className="text-muted-foreground px-4 py-2" asChild>
                  <Link to="/price-plans" className="flex items-center">
                 
                    <Trans>Subscriptions</Trans>
                  </Link>
                </DropdownMenuItem>
              )} */}

              <DropdownMenuItem
                className="text-muted-foreground px-4 py-2"
                onClick={() => setLanguageSwitcherOpen(true)}
              >
                <Trans>Language</Trans>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-destructive/90 hover:!text-destructive px-4 py-2"
                onSelect={async () => authClient.signOut()}
              >
                <Trans>Sign Out</Trans>
              </DropdownMenuItem>
            </div>
          </div>
        </div>
      </DropdownMenuContent>

      <LanguageSwitcherDialog open={languageSwitcherOpen} setOpen={setLanguageSwitcherOpen} />

      <OrganisationCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Create More Organisations</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Please contact us at{' '}
                <a
                  href="mailto:help@nomiadocs.com"
                  className="text-primary underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  help@nomiadocs.com
                </a>{' '}
                to create more than {String(maxOrganisationCount)} organisation{maxOrganisationCount !== 1 ? 's' : ''}.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setContactModalOpen(false)}>
              <Trans>Close</Trans>
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.location.href = 'mailto:help@nomiadocs.com';
              }}
            >
              <Trans>Contact Us</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};
