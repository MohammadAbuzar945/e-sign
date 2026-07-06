import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/r.$affiliateSlug';

export function meta({ params }: Route.MetaArgs) {
  return appMetaTags(`Buy credits from ${params.affiliateSlug}`);
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await getSession(request);

  return {
    affiliateSlug: params.affiliateSlug,
    isAuthenticated: Boolean(user),
    returnUrl: `/r/${params.affiliateSlug}`,
  };
};

export default function AffiliateResellerPage({ loaderData }: Route.ComponentProps) {
  const { affiliateSlug, isAuthenticated, returnUrl } = loaderData;
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: organisations, isLoading: isOrganisationsLoading } =
    trpc.organisation.internal.getOrganisationSession.useQuery(undefined, {
      enabled: isAuthenticated,
    });

  const purchaserOrganisation =
    organisations?.find((org) => org.type === 'ORGANISATION') ?? organisations?.[0];

  const { data: affiliate, isLoading } = trpc.organisation.reseller.getAffiliate.useQuery({
    affiliateSlug,
  });

  const { mutateAsync: initializePurchase, isPending } =
    trpc.organisation.reseller.initializePurchase.useMutation({
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
      onError: (error) => {
        toast({
          title: _(msg`Purchase failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  useEffect(() => {
    if (!isAuthenticated) {
      const signInUrl = `/signin?callbackUrl=${encodeURIComponent(returnUrl)}`;
      navigate(signInUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, returnUrl]);

  if (!isAuthenticated || isLoading || isOrganisationsLoading) {
    return null;
  }

  if (!affiliate) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert variant="destructive">
          <AlertTitle>
            <Trans>Reseller not found</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>This affiliate link is invalid or no longer active.</Trans>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!affiliate.hasPackages) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert>
          <AlertTitle>
            <Trans>No packages available</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>No packages are currently available for sale.</Trans>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold">
          <Trans>Buy e-sign credits</Trans>
        </h1>
        <p className="mt-2 text-muted-foreground">
          <Trans>Purchase credits from {affiliate.organisationName}</Trans>
        </p>
      </div>

      <div className="grid gap-4">
        {affiliate.packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader>
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription>{pkg.displayPrice}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                loading={isPending}
                disabled={!purchaserOrganisation}
                onClick={async () => {
                  if (!purchaserOrganisation) {
                    return;
                  }

                  await initializePurchase({
                    affiliateSlug,
                    packageId: pkg.id,
                    organisationId: purchaserOrganisation.id,
                  });
                }}
              >
                <Trans>Buy {pkg.creditAmount} credits</Trans>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="ghost" asChild>
        <Link to={purchaserOrganisation ? `/o/${purchaserOrganisation.url}` : '/'}>
          <Trans>Back to dashboard</Trans>
        </Link>
      </Button>
    </div>
  );
}
