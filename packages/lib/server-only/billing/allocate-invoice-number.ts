import type { Prisma } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

export const NOMIA_INVOICE_NUMBER_PREFIX = 'NOM' as const;
export const RESELLER_INVOICE_NUMBER_PREFIX = 'RS' as const;

/** Single platform-wide continuous counter for every invoice (Nomia + all resellers). */
export const PLATFORM_INVOICE_SEQUENCE_PREFIX = 'INV' as const;
export const PLATFORM_INVOICE_SEQUENCE_SELLER_KEY = 'platform' as const;
export const CONTINUOUS_INVOICE_SEQUENCE_DATE_KEY = 'ALL' as const;

export type InvoiceNumberPrefix =
  | typeof NOMIA_INVOICE_NUMBER_PREFIX
  | typeof RESELLER_INVOICE_NUMBER_PREFIX;

type DbClient = Prisma.TransactionClient | typeof prisma;

export const formatInvoiceDateKeyUtc = (issuedAt: Date) => {
  const year = issuedAt.getUTCFullYear().toString().padStart(4, '0');
  const month = (issuedAt.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = issuedAt.getUTCDate().toString().padStart(2, '0');

  return `${year}${month}${day}`;
};

export const formatSequentialInvoiceNumber = ({
  prefix,
  dateKey,
  sequence,
}: {
  prefix: InvoiceNumberPrefix;
  dateKey: string;
  sequence: number;
}) => `${prefix}-${dateKey}-${sequence.toString().padStart(3, '0')}`;

/**
 * Atomically allocates the next display invoice number from the shared
 * platform counter. Sequence continues across days, issuers, and resellers.
 * The date segment is the issue date only.
 */
export const allocateInvoiceNumber = async ({
  prefix,
  issuedAt,
  tx = prisma,
}: {
  prefix: InvoiceNumberPrefix;
  issuedAt: Date;
  tx?: DbClient;
}) => {
  const displayDateKey = formatInvoiceDateKeyUtc(issuedAt);
  const id = `c${nanoid(24)}`;

  const rows = await tx.$queryRaw<{ nextValue: number }[]>`
    INSERT INTO "InvoiceNumberSequence" ("id", "prefix", "sellerKey", "dateKey", "nextValue")
    VALUES (
      ${id},
      ${PLATFORM_INVOICE_SEQUENCE_PREFIX},
      ${PLATFORM_INVOICE_SEQUENCE_SELLER_KEY},
      ${CONTINUOUS_INVOICE_SEQUENCE_DATE_KEY},
      1
    )
    ON CONFLICT ("prefix", "sellerKey", "dateKey")
    DO UPDATE SET "nextValue" = "InvoiceNumberSequence"."nextValue" + 1
    RETURNING "nextValue"
  `;

  const sequence = rows[0]?.nextValue;

  if (!sequence || sequence < 1) {
    throw new Error('Failed to allocate invoice number');
  }

  return formatSequentialInvoiceNumber({
    prefix,
    dateKey: displayDateKey,
    sequence,
  });
};

export const allocateNomiaInvoiceNumber = async ({
  issuedAt,
  tx,
}: {
  issuedAt: Date;
  tx?: DbClient;
}) =>
  allocateInvoiceNumber({
    prefix: NOMIA_INVOICE_NUMBER_PREFIX,
    issuedAt,
    tx,
  });

export const allocateResellerInvoiceNumber = async ({
  issuedAt,
  tx,
}: {
  resellerOrganisationId?: string;
  issuedAt: Date;
  tx?: DbClient;
}) =>
  allocateInvoiceNumber({
    prefix: RESELLER_INVOICE_NUMBER_PREFIX,
    issuedAt,
    tx,
  });

/** Prefer the sequential display number; fall back for pending / legacy rows. */
export const resolveDisplayInvoiceNumber = (invoiceNumber: string | null | undefined) =>
  invoiceNumber?.trim() || '—';
