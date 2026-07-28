import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import {
  canAccessInvoiceHistory,
  canAccessResellerCheckout,
  RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
} from '@documenso/lib/constants/demo-feature-flags';
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
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
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
  const [isReconsentOpen, setIsReconsentOpen] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [isSwitchingToNomia, setIsSwitchingToNomia] = useState(false);
  const [stickyBillingOptIn, setStickyBillingOptIn] = useState<boolean | null>(null);
  const isSwitchingToNomiaRef = useRef(false);
  const { sessionData } = useOptionalSession();

  const isAuthenticated = Boolean(sessionData);
  const isEmailVerified = Boolean(sessionData?.user?.emailVerified);
  const organisations = sessionData?.organisations ?? [];
  const currentUserId = sessionData?.user?.id;

  const ownedOrganisations = useMemo(
    () => organisations.filter((org) => org.ownerUserId === currentUserId),
    [organisations, currentUserId],
  );

  const [selectedOrganisationId, setSelectedOrganisationId] = useState<string | null>(null);
  const orgUrlFromQuery = searchParams.get('orgUrl');

  useEffect(() => {
    if (ownedOrganisations.length === 0) {
      setSelectedOrganisationId(null);
      return;
    }

    const organisationFromBillingContext = orgUrlFromQuery
      ? ownedOrganisations.find((org) => org.url === orgUrlFromQuery)
      : null;

    if (organisationFromBillingContext) {
      if (selectedOrganisationId !== organisationFromBillingContext.id) {
        setSelectedOrganisationId(organisationFromBillingContext.id);
      }

      return;
    }

    const hasSelectedOrganisation = ownedOrganisations.some(
      (org) => org.id === selectedOrganisationId,
    );

    if (selectedOrganisationId && hasSelectedOrganisation) {
      return;
    }

    setSelectedOrganisationId(ownedOrganisations[0].id);
  }, [ownedOrganisations, orgUrlFromQuery, selectedOrganisationId]);

  const purchaserOrganisation =
    ownedOrganisations.find((org) => org.id === selectedOrganisationId) ?? null;
  const isPurchaseHistoryOwner = Boolean(purchaserOrganisation);
  const canViewPurchaseHistory =
    isPurchaseHistoryOwner && canAccessInvoiceHistory(sessionData?.user?.email);
  const canLoadBillingAttribution =
    isAuthenticated && isEmailVerified && Boolean(purchaserOrganisation);

  const { data: affiliate, isLoading } = trpc.organisation.reseller.getAffiliate.useQuery({
    affiliateSlug,
  });

  const { data: billingAttribution, refetch: refetchBillingAttribution } =
    trpc.organisation.reseller.getBillingAttribution.useQuery(
      {
        organisationId: purchaserOrganisation?.id ?? '',
      },
      {
        enabled: Boolean(canLoadBillingAttribution && purchaserOrganisation?.id),
      },
    );

  const canManageStickyBilling =
    canLoadBillingAttribution &&
    Boolean(affiliate) &&
    affiliate?.organisationId !== purchaserOrganisation?.id;

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
    setStickyBillingOptIn(null);
  }, [purchaserOrganisation?.id]);

  useEffect(() => {
    if (!billingAttribution) {
      return;
    }

    setStickyBillingOptIn(billingAttribution.stickyBillingOptIn);
  }, [billingAttribution]);

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

  const { mutateAsync: clearResellerAssociation } =
    trpc.organisation.reseller.clearResellerAssociation.useMutation();

  const { mutateAsync: setStickyBillingOptInMutation, isPending: isUpdatingStickyBilling } =
    trpc.organisation.reseller.setStickyBillingOptIn.useMutation();

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
  // If the reseller went delinquent, the org is flagged for reconsent (§12.3 / §12.5): sticky
  // billing is paused until the customer explicitly reconfirms, so we surface a modal here.
  useEffect(() => {
    if (
      !isAuthenticated ||
      !isEmailVerified ||
      !purchaserOrganisation ||
      !affiliate ||
      isSwitchingToNomia
    ) {
      return;
    }

    void associateReseller({
      organisationId: purchaserOrganisation.id,
      affiliateSlug,
      source: 'AFFILIATE_VISIT',
    })
      .then((result) => {
        if (isSwitchingToNomiaRef.current) {
          return;
        }

        const needsReconsent =
          Boolean(result?.requiresReconsent) ||
          result?.reason === 'NEEDS_RECONSENT' ||
          result?.reason === 'DELINQUENT_NEEDS_CONSENT';

        if (needsReconsent) {
          setIsReconsentOpen(true);
        }

        void refetchBillingAttribution();
      })
      .catch(() => {
        // Non-blocking.
      });
  }, [
    affiliate,
    affiliateSlug,
    associateReseller,
    isAuthenticated,
    isEmailVerified,
    isSwitchingToNomia,
    purchaserOrganisation,
    refetchBillingAttribution,
  ]);

  const getStickyBillingOptInErrorMessage = (reason?: string) => {
    switch (reason) {
      case 'IS_RESELLER':
        return _(
          msg`Could not update sticky billing for this organisation.`,
        );
      case 'SELF':
        return _(msg`You cannot opt into your own reseller billing page.`);
      case 'RESELLER_INACTIVE':
        return _(msg`This reseller is not available for sticky billing right now.`);
      case 'ALREADY_ASSOCIATED':
        return _(
          msg`Your organisation is already linked to a different reseller. Clear that link before opting in here.`,
        );
      case 'NEEDS_RECONSENT':
      case 'DELINQUENT_NEEDS_CONSENT':
        return _(msg`Please confirm this reseller first before turning sticky billing on.`);
      default:
        return _(msg`Please try again.`);
    }
  };

  const handleStickyBillingOptInChange = async (optIn: boolean) => {
    if (!purchaserOrganisation || stickyBillingOptIn === optIn) {
      return;
    }

    const previous = stickyBillingOptIn;
    setStickyBillingOptIn(optIn);

    try {
      const result = await setStickyBillingOptInMutation({
        organisationId: purchaserOrganisation.id,
        affiliateSlug,
        optIn,
      });

      if (!result.success) {
        setStickyBillingOptIn(previous);

        toast({
          title: _(msg`Could not update preference`),
          description: getStickyBillingOptInErrorMessage(result.reason),
          variant: 'destructive',
        });

        return;
      }

      setStickyBillingOptIn(result.stickyBillingOptIn ?? optIn);
      void refetchBillingAttribution();
    } catch (error) {
      setStickyBillingOptIn(previous);

      toast({
        title: _(msg`Could not update preference`),
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    }
  };

  const handleConfirmReconsent = async () => {
    if (!purchaserOrganisation) {
      return;
    }

    setIsSubmittingConsent(true);

    try {
      const result = await associateReseller({
        organisationId: purchaserOrganisation.id,
        affiliateSlug,
        source: 'CUSTOMER_CONSENT',
        customerConsent: true,
      });

      if (result?.associated) {
        setStickyBillingOptIn(true);

        toast({
          title: _(msg`Reseller confirmed`),
          description: _(
            msg`Your purchases will continue to be supported by ${affiliate?.resellerDisplayName ?? 'this reseller'}.`,
          ),
          variant: 'default',
        });

        setIsReconsentOpen(false);
        void refetchPurchaseHistory();
        void refetchBillingAttribution();
        return;
      }

      toast({
        title: _(msg`Could not confirm reseller`),
        description: _(msg`Please try again or continue with Nomia billing.`),
        variant: 'destructive',
      });
    } catch (error) {
      toast({
        title: _(msg`Something went wrong`),
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingConsent(false);
    }
  };

  const handleUseNomiaBilling = async () => {
    if (!purchaserOrganisation?.url) {
      return;
    }

    isSwitchingToNomiaRef.current = true;
    setIsSwitchingToNomia(true);
    setIsReconsentOpen(false);
    setIsSubmittingConsent(true);
    setStickyBillingOptIn(false);

    try {
      // Opt out of sticky reseller attribution so Billing/price-plan stay on Nomia.
      await clearResellerAssociation({
        organisationId: purchaserOrganisation.id,
      });

      navigate(`/o/${purchaserOrganisation.url}/price-plan?resellerUnavailable=1`);
    } catch (error) {
      isSwitchingToNomiaRef.current = false;
      setIsSwitchingToNomia(false);
      setIsReconsentOpen(true);

      toast({
        title: _(msg`Could not switch to Nomia`),
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingConsent(false);
    }
  };

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

  const returnTo = orgUrlFromQuery
    ? `/r/${affiliateSlug}?orgUrl=${encodeURIComponent(orgUrlFromQuery)}`
    : `/r/${affiliateSlug}`;

  const handleBuyNow = async (packageId: string) => {
    if (!isAuthenticated) {
      navigate(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!canAccessResellerCheckout(sessionData?.user?.email)) {
      toast({
        title: _(msg`Coming soon`),
        description: RESELLER_DEMO_EXTRAS_DENIED_MESSAGE,
      });
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
      <Dialog open={isReconsentOpen} onOpenChange={setIsReconsentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Trans>Confirm your reseller</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                {affiliate.resellerDisplayName} referred you to Nomia, but their reseller account
                currently needs your confirmation before we continue attributing your purchases to
                them. You can confirm to continue with this reseller, or switch to buying directly
                from Nomia.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={handleUseNomiaBilling}
              disabled={isSubmittingConsent || isSwitchingToNomia}
              loading={isSwitchingToNomia}
            >
              <Trans>Use Nomia billing instead</Trans>
            </Button>
            <Button
              onClick={handleConfirmReconsent}
              loading={isSubmittingConsent && !isSwitchingToNomia}
              disabled={isSwitchingToNomia}
            >
              <Trans>Yes, continue with {affiliate.resellerDisplayName}</Trans>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

        <div className="flex flex-col items-center gap-3 sm:items-end">
          {isAuthenticated ? (
            <>
              {ownedOrganisations.length > 0 ? (
                <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
                  <Label
                    htmlFor="affiliate-purchase-organisation"
                    className="text-xs text-muted-foreground"
                  >
                    <Trans>Buying for</Trans>
                  </Label>
                  {ownedOrganisations.length > 1 ? (
                    <Select
                      value={selectedOrganisationId ?? undefined}
                      onValueChange={(organisationId) => {
                        setSelectedOrganisationId(organisationId);

                        const selectedOrganisation = ownedOrganisations.find(
                          (org) => org.id === organisationId,
                        );

                        if (!selectedOrganisation) {
                          return;
                        }

                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('orgUrl', selectedOrganisation.url);
                        setSearchParams(nextParams, { replace: true });
                      }}
                    >
                      <SelectTrigger
                        id="affiliate-purchase-organisation"
                        className="w-full sm:w-[240px]"
                      >
                        <SelectValue placeholder={_(msg`Select organisation`)} />
                      </SelectTrigger>
                      <SelectContent>
                        {ownedOrganisations.map((organisation) => (
                          <SelectItem key={organisation.id} value={organisation.id}>
                            {organisation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p
                      id="affiliate-purchase-organisation"
                      className="text-sm font-medium text-foreground"
                    >
                      {ownedOrganisations[0].name}
                    </p>
                  )}
                </div>
              ) : null}

              <Button variant="outline" size="sm" asChild>
                <Link to={purchaserOrganisation ? `/o/${purchaserOrganisation.url}` : '/'}>
                  <Trans>Go to dashboard</Trans>
                </Link>
              </Button>
            </>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <AlertTitle>
              <Trans>Reseller purchase</Trans>
            </AlertTitle>
            <AlertDescription>{affiliate.disclosure}</AlertDescription>
          </div>

          {canManageStickyBilling && (
            <div className="flex shrink-0 items-center gap-3 self-start sm:pt-0.5">
              <Label
                htmlFor="sticky-billing-opt-in"
                className={cn(
                  'text-sm font-medium leading-none transition-colors',
                  stickyBillingOptIn === true
                    ? 'text-foreground opacity-100'
                    : 'text-muted-foreground opacity-50',
                )}
              >
                <Trans>Always buy from this reseller</Trans>
              </Label>
              <Switch
                id="sticky-billing-opt-in"
                className={cn(
                  stickyBillingOptIn === true && 'opacity-100 disabled:opacity-100',
                )}
                checked={stickyBillingOptIn === true}
                disabled={isUpdatingStickyBilling || stickyBillingOptIn === null}
                onCheckedChange={(checked) => {
                  void handleStickyBillingOptInChange(checked);
                }}
              />
            </div>
          )}
        </div>
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

      {isPurchaseHistoryOwner && purchaserOrganisation && (
        <div className="flex justify-end">
          <OrganisationPurchaseHistoryDialog
            orgUrl={purchaserOrganisation.url}
            purchaseHistory={purchaseHistory}
            isComingSoon={!canViewPurchaseHistory}
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
