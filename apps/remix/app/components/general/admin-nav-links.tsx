import { Trans } from '@lingui/react/macro';
import {
  BarChart3,
  FileStack,
  LayersIcon,
  Settings,
  StoreIcon,
  Trophy,
  Users,
  WebhookIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

type AdminNavLinksProps = {
  onNavigate?: () => void;
  className?: string;
  buttonClassName?: string;
};

export const AdminNavLinks = ({
  onNavigate,
  className,
  buttonClassName,
}: AdminNavLinksProps) => {
  const { pathname } = useLocation();
  const { user } = useSession();

  const isResellerFeatureAllowed = user.email
    ? isResellerFeatureAllowedEmail(user.email)
    : false;

  const items = [
    {
      href: '/admin/stats',
      label: <Trans>Stats</Trans>,
      icon: BarChart3,
      isActive: pathname?.startsWith('/admin/stats'),
    },
    {
      href: '/admin/users',
      label: <Trans>Users</Trans>,
      icon: Users,
      isActive: pathname?.startsWith('/admin/users'),
    },
    {
      href: '/admin/documents',
      label: <Trans>Documents</Trans>,
      icon: FileStack,
      isActive: pathname?.startsWith('/admin/documents'),
    },
    {
      href: '/admin/organisation-insights',
      label: <Trans>Organisation Insights</Trans>,
      icon: Trophy,
      isActive: pathname?.startsWith('/admin/organisation-insights'),
    },
    ...(isResellerFeatureAllowed
      ? [
          {
            href: '/admin/reseller-applications',
            label: <Trans>Resellers</Trans>,
            icon: StoreIcon,
            isActive: pathname?.startsWith('/admin/reseller-applications'),
          },
          {
            href: '/admin/reseller-bulk-rates',
            label: <Trans>Bulk rates</Trans>,
            icon: LayersIcon,
            isActive: pathname?.startsWith('/admin/reseller-bulk-rates'),
          },
        ]
      : []),
    {
      href: '/admin/paystack-webhooks',
      label: <Trans>Paystack Webhooks</Trans>,
      icon: WebhookIcon,
      isActive: pathname?.startsWith('/admin/paystack-webhooks'),
    },
    {
      href: '/admin/site-settings',
      label: <Trans>Site Settings</Trans>,
      icon: Settings,
      isActive: pathname?.startsWith('/admin/site-settings'),
    },
  ];

  return (
    <nav className={cn('flex flex-col gap-1', className)} aria-label="Admin navigation">
      {items.map((item) => (
        <Button
          key={item.href}
          variant="ghost"
          className={cn(
            'h-auto min-h-10 w-full justify-start whitespace-normal px-3 py-2 text-left',
            item.isActive && 'bg-secondary',
            buttonClassName,
          )}
          asChild
        >
          <Link to={item.href} onClick={onNavigate}>
            <item.icon className="mr-2 h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
};
