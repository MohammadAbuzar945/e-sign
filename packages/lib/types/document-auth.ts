import { z } from 'zod';

import { ZAuthenticationResponseJSONSchema } from './webauthn';

/**
 * All the available types of document authentication options for both access and action.
 */
export const ZDocumentAuthTypesSchema = z.enum([
  'ACCOUNT',
  'PASSKEY',
  'TWO_FACTOR_AUTH',
  'PASSWORD',
  'KBA',
  'EXPLICIT_NONE',
]);

export const DocumentAuth = ZDocumentAuthTypesSchema.Enum;

const ZDocumentAuthAccountSchema = z.object({
  type: z.literal(DocumentAuth.ACCOUNT),
});

const ZDocumentAuthExplicitNoneSchema = z.object({
  type: z.literal(DocumentAuth.EXPLICIT_NONE),
});

const ZDocumentAuthPasskeySchema = z.object({
  type: z.literal(DocumentAuth.PASSKEY),
  authenticationResponse: ZAuthenticationResponseJSONSchema,
  tokenReference: z.string().min(1),
});

const ZDocumentAuthPasswordSchema = z.object({
  type: z.literal(DocumentAuth.PASSWORD),
  password: z.string().min(1),
});

const ZDocumentAuth2FASchema = z.object({
  type: z.literal(DocumentAuth.TWO_FACTOR_AUTH),
  token: z.string().min(4).max(10),
  method: z.enum(['email', 'authenticator']).default('authenticator').optional(),
});

const ZDocumentAuthKBASchema = z.object({
  type: z.literal(DocumentAuth.KBA),
  answer: z.string().min(1),
});

/**
 * All the document auth methods for both accessing and actioning.
 */
export const ZDocumentAuthMethodsSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthExplicitNoneSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthKBASchema,
  ZDocumentAuthPasswordSchema,
]);

/**
 * The global document access auth methods.
 *
 * Must keep these two in sync.
 */
export const ZDocumentAccessAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthKBASchema,
]);
export const ZDocumentAccessAuthTypesSchema = z
  .enum([DocumentAuth.ACCOUNT, DocumentAuth.TWO_FACTOR_AUTH, DocumentAuth.KBA])
  .describe('The type of authentication required for the recipient to access the document.');

/**
 * The global document action auth methods.
 *
 * Must keep these two in sync.
 */
export const ZDocumentActionAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthPasswordSchema,
]);
export const ZDocumentActionAuthTypesSchema = z
  .enum([
    DocumentAuth.ACCOUNT,
    DocumentAuth.PASSKEY,
    DocumentAuth.TWO_FACTOR_AUTH,
    DocumentAuth.PASSWORD,
  ])
  .describe(
    'The type of authentication required for the recipient to sign the document. This field is restricted to Enterprise plan users only.',
  );

/**
 * The recipient access auth methods.
 *
 * Must keep these two in sync.
 */
export const ZRecipientAccessAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthKBASchema,
]);
export const ZRecipientAccessAuthTypesSchema = z
  .enum([DocumentAuth.ACCOUNT, DocumentAuth.TWO_FACTOR_AUTH, DocumentAuth.KBA])
  .describe('The type of authentication required for the recipient to access the document.');

export const ZDocumentKbaModeSchema = z.enum(['PER_ENVELOPE', 'PER_RECIPIENT']);
export const ZDocumentKbaAnswerTypeSchema = z.enum(['STRING', 'NUMERIC', 'MCQ']);
export const ZDocumentKbaOptionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const ZDocumentKbaChallengeInputSchema = z
  .object({
    answerType: ZDocumentKbaAnswerTypeSchema,
    question: z.string().min(1),
    answer: z.string().min(1),
    mcqOptions: z.array(ZDocumentKbaOptionSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.answerType === 'NUMERIC') {
      const trimmed = value.answer.trim();

      if (trimmed && !/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Numeric KBA answers must contain digits only (0-9).',
          path: ['answer'],
        });
      }
    }

    if (value.answerType !== 'MCQ') {
      return;
    }

    if (!value.mcqOptions || value.mcqOptions.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ challenges require at least 2 options',
        path: ['mcqOptions'],
      });
      return;
    }

    const hasMatchingOption = value.mcqOptions.some((option) => option.key === value.answer);

    if (!hasMatchingOption) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ answer must match one of the option keys',
        path: ['answer'],
      });
    }
  });

export const ZDocumentKbaSettingsSchema = z.object({
  mode: ZDocumentKbaModeSchema.default('PER_ENVELOPE'),
  isEnabled: z.boolean().default(false),
  maxAttempts: z.number().int().min(1).max(20).default(5),
  lockoutMinutes: z.number().int().min(1).max(1440).default(15),
});

/**
 * The recipient action auth methods.
 *
 * Must keep these two in sync.
 */
export const ZRecipientActionAuthSchema = z.discriminatedUnion('type', [
  ZDocumentAuthAccountSchema,
  ZDocumentAuthPasskeySchema,
  ZDocumentAuth2FASchema,
  ZDocumentAuthPasswordSchema,
  ZDocumentAuthExplicitNoneSchema,
]);
export const ZRecipientActionAuthTypesSchema = z
  .enum([
    DocumentAuth.ACCOUNT,
    DocumentAuth.PASSKEY,
    DocumentAuth.TWO_FACTOR_AUTH,
    DocumentAuth.PASSWORD,
    DocumentAuth.EXPLICIT_NONE,
  ])
  .describe('The type of authentication required for the recipient to sign the document.');

export const DocumentAccessAuth = ZDocumentAccessAuthTypesSchema.Enum;
export const DocumentActionAuth = ZDocumentActionAuthTypesSchema.Enum;
export const RecipientAccessAuth = ZRecipientAccessAuthTypesSchema.Enum;
export const RecipientActionAuth = ZRecipientActionAuthTypesSchema.Enum;

/**
 * Authentication options attached to the document.
 */
export const ZDocumentAuthOptionsSchema = z.preprocess(
  (unknownValue) => {
    if (!unknownValue || typeof unknownValue !== 'object') {
      return {
        globalAccessAuth: [],
        globalActionAuth: [],
        kbaAccessExplicitlyDisabled: false,
      };
    }

    const globalAccessAuth =
      'globalAccessAuth' in unknownValue
        ? stripAuthSentinelsFromArray(unknownValue.globalAccessAuth)
        : [];
    const globalActionAuth =
      'globalActionAuth' in unknownValue
        ? stripAuthSentinelsFromArray(unknownValue.globalActionAuth)
        : [];
    const kbaAccessExplicitlyDisabled =
      'kbaAccessExplicitlyDisabled' in unknownValue &&
      unknownValue.kbaAccessExplicitlyDisabled === true;

    return {
      globalAccessAuth,
      globalActionAuth,
      kbaAccessExplicitlyDisabled,
    };
  },
  z.object({
    globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema),
    globalActionAuth: z.array(ZDocumentActionAuthTypesSchema),
    /** When true, do not apply team/org default of requiring KBA in document access auth. */
    kbaAccessExplicitlyDisabled: z.boolean().optional(),
  }),
);

/**
 * Authentication options attached to the recipient.
 */
export const ZRecipientAuthOptionsSchema = z.preprocess(
  (unknownValue) => {
    if (!unknownValue || typeof unknownValue !== 'object') {
      return {
        accessAuth: [],
        actionAuth: [],
      };
    }

    const accessAuth =
      'accessAuth' in unknownValue ? stripAuthSentinelsFromArray(unknownValue.accessAuth) : [];
    const actionAuth =
      'actionAuth' in unknownValue ? stripAuthSentinelsFromArray(unknownValue.actionAuth) : [];

    return {
      accessAuth,
      actionAuth,
    };
  },
  z.object({
    accessAuth: z.array(ZRecipientAccessAuthTypesSchema),
    actionAuth: z.array(ZRecipientActionAuthTypesSchema),
  }),
);

/**
 * Utility function to process the auth value.
 *
 * Converts the old singular auth value to an array of auth values.
 */
const processAuthValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
};

/**
 * UI multiselect uses "-1" as the "No restrictions" sentinel; it must never be persisted for long,
 * but if it is, strip it so Zod enum validation and signing loaders do not throw (which surfaced
 * as 404 when combined with real methods e.g. ["-1", "KBA"]).
 */
const stripAuthSentinelsFromArray = (value: unknown): unknown[] => {
  return processAuthValue(value).filter(
    (entry) => entry !== '-1' && entry !== -1 && entry !== null && entry !== undefined,
  );
};

export type TDocumentAuth = z.infer<typeof ZDocumentAuthTypesSchema>;
export type TDocumentAuthMethods = z.infer<typeof ZDocumentAuthMethodsSchema>;
export type TDocumentAuthOptions = z.infer<typeof ZDocumentAuthOptionsSchema>;
export type TDocumentAccessAuth = z.infer<typeof ZDocumentAccessAuthSchema>;
export type TDocumentAccessAuthTypes = z.infer<typeof ZDocumentAccessAuthTypesSchema>;
export type TDocumentActionAuth = z.infer<typeof ZDocumentActionAuthSchema>;
export type TDocumentActionAuthTypes = z.infer<typeof ZDocumentActionAuthTypesSchema>;
export type TDocumentKbaMode = z.infer<typeof ZDocumentKbaModeSchema>;
export type TDocumentKbaAnswerType = z.infer<typeof ZDocumentKbaAnswerTypeSchema>;
export type TDocumentKbaOption = z.infer<typeof ZDocumentKbaOptionSchema>;
export type TDocumentKbaChallengeInput = z.infer<typeof ZDocumentKbaChallengeInputSchema>;
export type TDocumentKbaSettings = z.infer<typeof ZDocumentKbaSettingsSchema>;
export type TRecipientAccessAuth = z.infer<typeof ZRecipientAccessAuthSchema>;
export type TRecipientAccessAuthTypes = z.infer<typeof ZRecipientAccessAuthTypesSchema>;
export type TRecipientActionAuth = z.infer<typeof ZRecipientActionAuthSchema>;
export type TRecipientActionAuthTypes = z.infer<typeof ZRecipientActionAuthTypesSchema>;
export type TRecipientAuthOptions = z.infer<typeof ZRecipientAuthOptionsSchema>;
