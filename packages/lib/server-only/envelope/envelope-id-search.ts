import type { Prisma } from '@prisma/client';

const ENVELOPE_ID_PREFIX = 'envelope_';

// Avoid matching every envelope when the query is only the shared prefix.
const MIN_ENVELOPE_ID_SUFFIX_LENGTH = 3;

export const envelopeIdSearchFilter = (query: string): Prisma.EnvelopeWhereInput | null => {
  const normalizedQuery = query.trim();

  if (!normalizedQuery.toLowerCase().startsWith(ENVELOPE_ID_PREFIX)) {
    return null;
  }

  if (normalizedQuery.length < ENVELOPE_ID_PREFIX.length + MIN_ENVELOPE_ID_SUFFIX_LENGTH) {
    return null;
  }

  return {
    id: {
      contains: normalizedQuery,
      mode: 'insensitive',
    },
  };
};
