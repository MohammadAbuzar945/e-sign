import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { loadLogo } from '@documenso/lib/utils/images/logo';
import { prisma } from '@documenso/prisma';

import { getOrganisationPurchaseHistory } from './get-organisation-purchase-history';

export const resolveResellerInvoiceLogoDataUrl = async (
  affiliateSlug: string | null | undefined,
): Promise<string | null> => {
  if (!affiliateSlug) {
    return null;
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    select: {
      brandingEnabled: true,
      brandingLogo: true,
    },
  });

  if (!profile?.brandingEnabled || !profile.brandingLogo) {
    return null;
  }

  try {
    const file = await getFileServerSide(JSON.parse(profile.brandingLogo));
    const { content, contentType } = await loadLogo(file);

    return `data:${contentType};base64,${Buffer.from(content).toString('base64')}`;
  } catch (error) {
    console.error('[INVOICE]: Failed to load reseller logo', error);
    return null;
  }
};

export const getOrganisationPurchaseInvoice = async ({
  organisationId,
  invoiceId,
}: {
  organisationId: string;
  invoiceId: string;
}) => {
  const history = await getOrganisationPurchaseHistory({ organisationId });
  const invoice =
    history.find((item) => item.invoiceId === invoiceId) ??
    // Legacy hybrid emails used purchaseGroupId as the invoice id.
    history.find((item) => item.purchaseGroupId === invoiceId && item.issuer === 'RESELLER') ??
    history.find((item) => item.purchaseGroupId === invoiceId);

  if (!invoice) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: {
      name: true,
      url: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const resellerLogoUrl =
    invoice.resellerSeller?.hasLogo && invoice.resellerSeller.affiliateSlug
      ? await resolveResellerInvoiceLogoDataUrl(invoice.resellerSeller.affiliateSlug)
      : null;

  return {
    invoice,
    organisation,
    resellerLogoUrl,
  };
};

const getOrganisationOwner = async (organisationId: string) =>
  prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
    select: {
      name: true,
      url: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

/**
 * Resolves one or more purchase invoices for emailing.
 * Prefer `purchaseGroupId` for hybrid/split (all legs in one mail).
 */
export const getOrganisationPurchaseInvoicesForEmail = async ({
  organisationId,
  invoiceId,
  invoiceIds,
  purchaseGroupId,
}: {
  organisationId: string;
  invoiceId?: string;
  invoiceIds?: string[];
  purchaseGroupId?: string | null;
}) => {
  const history = await getOrganisationPurchaseHistory({ organisationId });
  const organisation = await getOrganisationOwner(organisationId);

  let invoices = [] as typeof history;

  if (purchaseGroupId) {
    invoices = history
      .filter((item) => item.purchaseGroupId === purchaseGroupId)
      .sort((a, b) => {
        if (a.issuer === b.issuer) {
          return a.invoiceId.localeCompare(b.invoiceId);
        }

        // Reseller leg first, then Nomia remainder.
        return a.issuer === 'RESELLER' ? -1 : 1;
      });
  }

  if (invoices.length === 0 && invoiceIds?.length) {
    invoices = invoiceIds
      .map(
        (id) =>
          history.find((item) => item.invoiceId === id) ??
          history.find((item) => item.purchaseGroupId === id && item.issuer === 'RESELLER') ??
          history.find((item) => item.purchaseGroupId === id),
      )
      .filter((item): item is (typeof history)[number] => Boolean(item));
  }

  if (invoices.length === 0 && invoiceId) {
    const invoice =
      history.find((item) => item.invoiceId === invoiceId) ??
      history.find((item) => item.purchaseGroupId === invoiceId && item.issuer === 'RESELLER') ??
      history.find((item) => item.purchaseGroupId === invoiceId);

    if (invoice) {
      invoices = [invoice];
    }
  }

  if (invoices.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const resellerLogoUrls = await Promise.all(
    invoices.map(async (invoice) =>
      invoice.resellerSeller?.hasLogo && invoice.resellerSeller.affiliateSlug
        ? await resolveResellerInvoiceLogoDataUrl(invoice.resellerSeller.affiliateSlug)
        : null,
    ),
  );

  return {
    invoices,
    organisation,
    resellerLogoUrls,
  };
};
