import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  buildPurchaseInvoiceHtml,
  buildPurchaseInvoicePdf,
  getOrganisationPurchaseInvoice,
} from '@documenso/lib/server-only/billing/build-purchase-invoice';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/o.$orgUrl.purchase-invoice.$invoiceId';

const getInvoiceLogoDataUrl = async () => {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'android-chrome-512x512.png');
    const logoBytes = await readFile(logoPath);

    return `data:image/png;base64,${logoBytes.toString('base64')}`;
  } catch {
    return undefined;
  }
};

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

  const { invoice, organisation: organisationDetails, resellerLogoUrl } =
    await getOrganisationPurchaseInvoice({
      organisationId: organisation.id,
      invoiceId: decodeURIComponent(invoiceId),
    });

  const logoUrl =
    (await getInvoiceLogoDataUrl()) ??
    `${new URL(request.url).origin}/android-chrome-512x512.png`;

  const html = buildPurchaseInvoiceHtml({
    invoice,
    organisationName: organisationDetails.name,
    customerName: organisationDetails.owner.name,
    customerEmail: organisationDetails.owner.email,
    logoUrl,
    resellerLogoUrl,
  });

  const pdf = await buildPurchaseInvoicePdf({ html });

  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nomia-invoice-${invoice.invoiceId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
};
