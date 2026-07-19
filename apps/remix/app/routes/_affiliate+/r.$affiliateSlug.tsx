import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { cn } from '@documenso/ui/lib/utils';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { appMetaTags } from '~/utils/meta';
import { OrganisationPurchaseHistoryDialog } from '~/components/general/organisation-purchase-history-dialog';

import type { Route } from './+types/r.$affiliateSlug';

const NOMIA_REDIRECT_DELAY_MS = 1800;

export function meta({ params }: Route.MetaArgs) {
  return appMetaTags(`Buy credits from ${params.affiliateSlug}`);
}

export default function AffiliateResellerPage({ params }: Route.ComponentProps) {
  const { affiliateSlug } = params;
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const { sessionData } = useOptionalSession();

  const isAuthenticated = Boolean(sessionData);
  const isEmailVerified = Boolean(sessionData?.user?.emailVerified);
  const organisations = sessionData?.organisations ?? [];
  const currentUserId = sessionData?.user?.id;

  const purchaserOrganisation = organisations.find((org) => org.ownerUserId === currentUserId);
  const canViewPurchaseHistory =
    Boolean(purchaserOrganisation) &&
    Boolean(currentUserId) &&
    purchaserOrganisation?.ownerUserId === currentUserId;

  const { data: affiliate, isLoading } = trpc.organisation.reseller.getAffiliate.useQuery({
    affiliateSlug,
  });

  const { data: purchaseHistory = [], refetch: refetchPurchaseHistory } =
    trpc.organisation.getPurchaseHistory.useQuery(
    {
      organisationId: purchaserOrganisation?.id ?? '',
    },
    {
      enabled: Boolean(canViewPurchaseHistory && purchaserOrganisation?.id),
    },
  );

  useEffect(() => {
    if (searchParams.get('purchase') !== 'success' || !canViewPurchaseHistory) {
      return;
    }

    void refetchPurchaseHistory();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('purchase');
    setSearchParams(nextParams, { replace: true });
  }, [
    canViewPurchaseHistory,
    refetchPurchaseHistory,
    searchParams,
    setSearchParams,
  ]);

  const { mutateAsync: associateReseller } =
    trpc.organisation.reseller.associateReseller.useMutation();

  const { mutateAsync: initializePurchase } =
    trpc.organisation.reseller.initializePurchase.useMutation({
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
      onError: (error) => {
        setPurchasingPackageId(null);

        toast({
          title: _(msg`Purchase failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const isResellerUnavailable = !isLoading && (!affiliate || !affiliate.hasPackages);
  const shouldRedirectToNomia =
    isResellerUnavailable && isAuthenticated && Boolean(purchaserOrganisation?.url);
  const nomiaPricePlanPath = purchaserOrganisation
    ? `/o/${purchaserOrganisation.url}/price-plan?resellerUnavailable=1`
    : null;

  // Sticky association when an authenticated, verified customer visits the affiliate link (§8.2).
  useEffect(() => {
    if (!isAuthenticated || !isEmailVerified || !purchaserOrganisation || !affiliate) {
      return;
    }

    void associateReseller({
      organisationId: purchaserOrganisation.id,
      affiliateSlug,
      source: 'AFFILIATE_VISIT',
    }).catch(() => {
      // Non-blocking.
    });
  }, [
    affiliate,
    affiliateSlug,
    associateReseller,
    isAuthenticated,
    isEmailVerified,
    purchaserOrganisation,
  ]);

  useEffect(() => {
    if (!shouldRedirectToNomia || !nomiaPricePlanPath) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate(nomiaPricePlanPath);
    }, NOMIA_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, nomiaPricePlanPath, shouldRedirectToNomia]);

  const returnTo = `/r/${affiliateSlug}`;

  const handleBuyNow = async (packageId: string) => {
    if (!isAuthenticated) {
      navigate(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!purchaserOrganisation) {
      toast({
        title: _(msg`Organisation required`),
        description: _(msg`You need an organisation to purchase credits.`),
        variant: 'destructive',
      });
      return;
    }

    setPurchasingPackageId(packageId);

    await initializePurchase({
      affiliateSlug,
      packageId,
      organisationId: purchaserOrganisation.id,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          <Trans>Loading...</Trans>
        </p>
      </div>
    );
  }

  if (shouldRedirectToNomia && nomiaPricePlanPath) {
    return (
      <Dialog open>
        <DialogContent hideClose className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Trans>Redirecting to Nomia</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                This reseller billing page is not available right now. Redirecting you to the Nomia
                price plan…
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button asChild>
              <Link to={nomiaPricePlanPath}>
                <Trans>Continue now</Trans>
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isResellerUnavailable) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Alert>
          <AlertTitle>
            <Trans>Reseller billing unavailable</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              This affiliate link is not available right now. Sign in to continue on the Nomia price
              plan, or try again later.
            </Trans>
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={`/signin?returnTo=${encodeURIComponent('/price-plans')}`}>
              <Trans>Sign in to Nomia billing</Trans>
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">
              <Trans>Go home</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!affiliate) {
    return null;
  }

  const hasBrandingLogo = affiliate.brandingEnabled && affiliate.brandingLogo;
  const brandingLogoUrl = `/api/branding/logo/reseller/${affiliate.affiliateSlug}`;
  const primaryColor = affiliate.brandingPrimaryColor || undefined;
  const pageTitle = affiliate.affiliatePageTitle;
  const pageDescription = affiliate.affiliatePageDescription;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
          {hasBrandingLogo && (
            <div className="flex w-full justify-center sm:justify-start">
              {affiliate.brandingUrl ? (
                <a href={affiliate.brandingUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={brandingLogoUrl}
                    alt={affiliate.resellerDisplayName}
                    className="h-16 w-auto max-w-xs object-contain"
                  />
                </a>
              ) : (
                <img
                  src={brandingLogoUrl}
                  alt={affiliate.resellerDisplayName}
                  className="h-16 w-auto max-w-xs object-contain"
                />
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {affiliate.resellerDisplayName}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {pageTitle || <Trans>Buy e-sign credits</Trans>}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {pageDescription || (
                <Trans>Purchase credits from {affiliate.resellerDisplayName}</Trans>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 sm:items-end">
          {isAuthenticated ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={purchaserOrganisation ? `/o/${purchaserOrganisation.url}` : '/'}>
                <Trans>Go to dashboard</Trans>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>
                <Trans>Sign in</Trans>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Alert>
        <AlertTitle>
          <Trans>Reseller purchase</Trans>
        </AlertTitle>
        <AlertDescription>{affiliate.disclosure}</AlertDescription>
      </Alert>

      {!affiliate.allowNegativeCredits && (
        <Alert variant={affiliate.availableCredits <= 0 ? 'warning' : 'neutral'}>
          <AlertTitle>
            <Trans>Reseller stock</Trans>
          </AlertTitle>
          <AlertDescription>
            {affiliate.availableCredits <= 0 ? (
              <Trans>
                This reseller currently has no credits in stock. Purchases will be fulfilled by
                Nomia.
              </Trans>
            ) : (
              <Trans>
                This reseller has {affiliate.availableCredits} credits in stock. Larger packs may
                be split with Nomia if stock runs out.
              </Trans>
            )}
          </AlertDescription>
        </Alert>
      )}

      {canViewPurchaseHistory && purchaserOrganisation && (
        <div className="flex justify-end">
          <OrganisationPurchaseHistoryDialog
            orgUrl={purchaserOrganisation.url}
            purchaseHistory={purchaseHistory}
          />
        </div>
      )}

      {affiliate.affiliateAboutText && (
        <div className="rounded-lg border bg-muted/20 p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {affiliate.affiliateAboutText}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {affiliate.packages.map((pkg) => (
          <Card
            key={pkg.id}
            className={cn('flex flex-col', pkg.isHighlighted && 'border-2 shadow-md')}
            style={
              pkg.isHighlighted && primaryColor ? { borderColor: primaryColor } : undefined
            }
          >
            <CardHeader className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {pkg.isHighlighted && (
                    <Badge
                      style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                    >
                      <Trans>Popular</Trans>
                    </Badge>
                  )}
                  {!affiliate.allowNegativeCredits && pkg.canPurchase && (
                    <Badge variant="neutral">
                      <Trans>In stock</Trans>
                    </Badge>
                  )}
                  {!affiliate.allowNegativeCredits && pkg.canPartialFulfill && (
                    <Badge variant="warning">
                      <Trans>Partial stock</Trans>
                    </Badge>
                  )}
                  {!affiliate.allowNegativeCredits &&
                    !pkg.canPurchase &&
                    !pkg.canPartialFulfill && (
                      <Badge variant="neutral">
                        <Trans>Via Nomia</Trans>
                      </Badge>
                    )}
                </div>
              </div>
              <CardDescription className="text-base font-medium text-foreground">
                {pkg.displayPrice}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <Trans>{pkg.creditAmount} e-sign credits</Trans>
              </p>
              {!affiliate.allowNegativeCredits && pkg.canPartialFulfill && (
                <p className="text-xs text-amber-700">
                  <Trans>
                    {pkg.availableResellerCredits} from reseller, remainder from Nomia
                  </Trans>
                </p>
              )}
              {!affiliate.allowNegativeCredits &&
                !pkg.canPurchase &&
                !pkg.canPartialFulfill && (
                  <p className="text-xs text-muted-foreground">
                    <Trans>Fulfilled by Nomia while reseller stock is empty</Trans>
                  </p>
                )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                loading={purchasingPackageId === pkg.id}
                disabled={purchasingPackageId !== null && purchasingPackageId !== pkg.id}
                style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                onClick={() => handleBuyNow(pkg.id)}
              >
                <Trans>Buy now</Trans>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Trans>Secure payment via Paystack</Trans>
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/20 p-5 text-sm text-muted-foreground">
        {affiliate.affiliateSupportEmail && (
          <p>
            <Trans>Questions?</Trans>{' '}
            <a
              href={`mailto:${affiliate.affiliateSupportEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {affiliate.affiliateSupportEmail}
            </a>
          </p>
        )}

        {affiliate.vatNumber && (
          <p>
            <Trans>VAT number: {affiliate.vatNumber}</Trans>
          </p>
        )}

        {affiliate.brandingEnabled && affiliate.brandingCompanyDetails && (
          <p className="whitespace-pre-wrap">{affiliate.brandingCompanyDetails}</p>
        )}
      </div>

      <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
        <Trans>Powered by Nomia</Trans>
      </footer>
    </div>
  );
}
