import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  buildPurchaseInvoiceHtml,
  getOrganisationPurchaseInvoice,
} from '@documenso/lib/server-only/billing/build-purchase-invoice';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/o.$orgUrl.purchase-invoice.$invoiceId';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await getSession(request);
  const { orgUrl, invoiceId } = params;

  const organisation = await prisma.organisation.findFirst({
    where: {
      url: orgUrl,
      members: {
        some: {
          userId: user.id,
        },
      },
    },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  if (organisation.ownerUserId !== user.id) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Only organisation owners can download purchase invoices',
    });
  }

  const { invoice, organisation: organisationDetails } = await getOrganisationPurchaseInvoice({
    organisationId: organisation.id,
    invoiceId: decodeURIComponent(invoiceId),
  });

  const html = buildPurchaseInvoiceHtml({
    invoice,
    organisationName: organisationDetails.name,
    customerName: organisationDetails.owner.name,
    customerEmail: organisationDetails.owner.email,
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="nomia-invoice-${invoice.invoiceId}.html"`,
    },
  });
};
