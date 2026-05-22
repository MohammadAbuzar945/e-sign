import type { Prisma } from '@prisma/client';

import {
  type TDocumentKbaSettings,
  ZDocumentKbaSettingsSchema,
} from '../types/document-auth';

/**
 * Normalise stored JSON (organisation/team settings or Prisma `Json`) into a full KBA settings object.
 */
export const normalizeStoredKbaSettings = (value: unknown): TDocumentKbaSettings => {
  return ZDocumentKbaSettingsSchema.parse(value ?? {});
};

/**
 * Serialise defaults for persisting on `OrganisationGlobalSettings`.
 */
export const getDefaultOrganisationKbaSettingsJson = (): Prisma.InputJsonValue => {
  return ZDocumentKbaSettingsSchema.parse({}) as Prisma.InputJsonValue;
};

/**
 * When creating an envelope, use explicit `kbaSettings` if provided; otherwise use team-derived defaults.
 */
export const resolveKbaSettingsForNewEnvelope = (
  explicit: TDocumentKbaSettings | null | undefined,
  derivedKbaSettings: unknown,
): TDocumentKbaSettings => {
  if (explicit !== undefined && explicit !== null) {
    return explicit;
  }

  return normalizeStoredKbaSettings(derivedKbaSettings);
};
