import type { DocumentData, Envelope, EnvelopeItem, Field } from '@prisma/client';
import {
  DocumentSigningOrder,
  DocumentStatus,
  EnvelopeType,
  FieldType,
  KbaScopeType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import { validateCheckboxLength } from '../../advanced-fields-validation/validate-checkbox';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  FIELD_META_DEFAULT_VALUES,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldAndMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putNormalizedPdfFileServerSide } from '../../universal/upload/put-file.server';
import { isDocumentCompleted } from '../../utils/document';
import { DocumentAuth } from '../../types/document-auth';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { toCheckboxCustomText, toRadioCustomText } from '../../utils/fields';
import {
  getRecipientsWithMissingFields,
  isRecipientEmailValidForSending,
} from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { isPersistedKbaChallengeCompleteForSend } from '../kba/kba';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

export type SendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  sendEmail?: boolean;
  requestMetadata: ApiRequestMetadata;
};

export const sendDocument = async ({
  id,
  userId,
  teamId,
  sendEmail,
  requestMetadata,
}: SendDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      fields: true,
      documentMeta: true,
      kbaPolicy: true,
      kbaChallenges: {
        where: {
          isActive: true,
        },
      },
      envelopeItems: {
        select: {
          id: true,
          documentData: {
            select: {
              type: true,
              id: true,
              data: true,
              initialData: true,
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  const signingOrder = envelope.documentMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  let recipientsToNotify = envelope.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active recipient.
    recipientsToNotify = envelope.recipients
      .filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC)
      .slice(0, 1);

    // Secondary filter so we aren't resending if the current active recipient has already
    // received the envelope.
    recipientsToNotify.filter((r) => r.sendStatus !== SendStatus.SENT);
  }

  if (envelope.envelopeItems.length === 0) {
    throw new Error('Missing envelope items');
  }

  if (envelope.formValues) {
    await Promise.all(
      envelope.envelopeItems.map(async (envelopeItem) => {
        await injectFormValuesIntoDocument(envelope, envelopeItem);
      }),
    );
  }

  const documentAuthForSend = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  if (documentAuthForSend.documentAuthOption.globalAccessAuth.includes(DocumentAuth.KBA)) {
    if (!envelope.kbaPolicy?.isEnabled) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Knowledge-based authentication (KBA) is required for this document but is not configured. Open Document Settings, enable Security, and set the KBA question and answer before sending.',
      });
    }

    const activeChallenges = envelope.kbaChallenges;

    if (envelope.kbaPolicy.mode === 'PER_ENVELOPE') {
      const envelopeChallenge = activeChallenges.find(
        (challenge) => challenge.scopeType === KbaScopeType.ENVELOPE,
      );

      if (!isPersistedKbaChallengeCompleteForSend(envelopeChallenge)) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message:
            'KBA is selected but the security question or answer is not fully configured. Open Document Settings → Security and set both the question and the answer before sending.',
        });
      }
    } else {
      const recipientsNeedingKba = envelope.recipients.filter(
        (recipient) => recipient.role !== RecipientRole.CC,
      );

      for (const recipient of recipientsNeedingKba) {
        const recipientChallenge = activeChallenges.find(
          (challenge) =>
            challenge.scopeType === KbaScopeType.RECIPIENT && challenge.recipientId === recipient.id,
        );

        if (!isPersistedKbaChallengeCompleteForSend(recipientChallenge)) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: `KBA is selected but the security question or answer is incomplete for a signer. Open Document Settings → Security and complete per-recipient KBA before sending.`,
          });
        }
      }
    }
  }

  // Validate that recipients with auth requirements have a valid email.
  envelope.recipients.forEach((recipient) => {
    const auth = extractDocumentAuthMethods({
      documentAuth: envelope.authOptions,
      recipientAuth: recipient.authOptions,
    });

    if (
      recipient.role !== RecipientRole.CC &&
      (auth.recipientAccessAuthRequired || auth.recipientActionAuthRequired) &&
      !isRecipientEmailValidForSending(recipient)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${recipient.id} requires an email because they have auth requirements.`,
      });
    }
  });

  // Validate that recipients who require fields (e.g., signers need signature fields) have them.
  const recipientsWithMissingFields = getRecipientsWithMissingFields(
    envelope.recipients,
    envelope.fields,
  );

  if (recipientsWithMissingFields.length > 0) {
    const missingRecipientIds = recipientsWithMissingFields.map((r) => r.id).join(', ');

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `The following recipients are missing required fields: ${missingRecipientIds}. Signers must have at least one signature field.`,
    });
  }

  const allRecipientsHaveNoActionToTake = envelope.recipients.every(
    (recipient) =>
      recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: legacyDocumentId,
        requestMetadata: requestMetadata?.requestMetadata,
      },
    });

    // Keep the return type the same for the `sendDocument` method
    return await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  }

  const fieldsToAutoInsert: { fieldId: number; customText: string }[] = [];

  // Validate and autoinsert fields for V2 envelopes.
  if (envelope.internalVersion === 2) {
    for (const unknownField of envelope.fields) {
      const recipient = envelope.recipients.find((r) => r.id === unknownField.recipientId);

      if (!recipient) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Recipient not found',
        });
      }

      const fieldToAutoInsert = extractFieldAutoInsertValues(unknownField);

      // Only auto-insert fields if the recipient has not been sent the document yet.
      if (fieldToAutoInsert && recipient.sendStatus !== SendStatus.SENT) {
        fieldsToAutoInsert.push(fieldToAutoInsert);
      }
    }
  }

  const updatedEnvelope = await prisma.$transaction(async (tx) => {
    if (envelope.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {},
        }),
      });
    }

    if (envelope.internalVersion === 2) {
      const autoInsertedFields = await Promise.all(
        fieldsToAutoInsert.map(async (field) => {
          // Warning: Only auto-insert fields if the recipient has not been sent the document yet.
          return await tx.field.update({
            where: {
              id: field.fieldId,
            },
            data: {
              customText: field.customText,
              inserted: true,
            },
          });
        }),
      );

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELDS_AUTO_INSERTED,
          envelopeId: envelope.id,
          data: {
            fields: autoInsertedFields.map((field) => ({
              fieldId: field.id,
              fieldType: field.type,
              recipientId: field.recipientId,
            })),
          },
          // Don't put metadata or user here since it's a system event.
        }),
      });
    }

    return await tx.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  });

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  // Only send email if one of the following is true:
  // - It is explicitly set
  // - The email is enabled for signing requests AND sendEmail is undefined
  if (sendEmail || (isRecipientSigningRequestEmailEnabled && sendEmail === undefined)) {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
        if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
          return;
        }

        await jobs.triggerJob({
          name: 'send.signing.requested.email',
          payload: {
            userId,
            documentId: legacyDocumentId,
            recipientId: recipient.id,
            requestMetadata: requestMetadata?.requestMetadata,
          },
        });
      }),
    );
  }

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId,
    teamId,
  });

  // Call external webhook if envelope.fromNomia is true with the same payload shape as internal webhooks
  if (envelope.fromNomia) {
    console.log('Calling external webhook in sent');

    const payload = ZWebhookDocumentSchema.parse(
      mapEnvelopeToWebhookDocumentPayload(updatedEnvelope),
    );

    const webhookEndpoint =
      NEXT_PUBLIC_WEBAPP_URL() === 'https://sign.nomiadocs.com'
        ? 'https://tapi.nomiadocs.com/esignature/documentSendv1'
        : 'https://api.nomiadocs.com/esignature/documentSendv1';

    const payloadData = {
      event: WebhookTriggerEvents.DOCUMENT_SENT,
      payload,
      createdAt: new Date().toISOString(),
      webhookEndpoint,
    };

    await fetch(webhookEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadData),
    });
  }



  return updatedEnvelope;
};

const injectFormValuesIntoDocument = async (
  envelope: Envelope,
  envelopeItem: Pick<EnvelopeItem, 'id'> & { documentData: DocumentData },
) => {
  const file = await getFileServerSide(envelopeItem.documentData);

  const prefilled = await insertFormValuesInPdf({
    pdf: Buffer.from(file),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    formValues: envelope.formValues as Record<string, string | number | boolean>,
  });

  let fileName = envelope.title;

  if (!envelope.title.endsWith('.pdf')) {
    fileName = `${envelope.title}.pdf`;
  }

  const newDocumentData = await putNormalizedPdfFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(prefilled),
  });

  await prisma.envelopeItem.update({
    where: {
      id: envelopeItem.id,
    },
    data: {
      documentDataId: newDocumentData.id,
    },
  });
};

/**
 * Extracts the auto insertion values for a given field.
 *
 * If field is not auto insertable, returns `null`.
 */
export const extractFieldAutoInsertValues = (
  unknownField: Field,
): { fieldId: number; customText: string } | null => {
  const parsedField = ZFieldAndMetaSchema.safeParse({
    ...unknownField,
    fieldMeta: unknownField.fieldMeta ?? FIELD_META_DEFAULT_VALUES[unknownField.type],
  });

  if (!parsedField.success) {
    // eslint-disable-next-line no-console
    console.warn('Skipping auto-insert for field with invalid metadata', {
      fieldId: unknownField.id,
      error: parsedField.error,
    });

    return null;
  }

  const field = parsedField.data;
  const fieldId = unknownField.id;

  // Auto insert text fields with prefilled values.
  if (field.type === FieldType.TEXT) {
    const { text } = ZTextFieldMeta.parse(field.fieldMeta);

    if (text) {
      return {
        fieldId,
        customText: text,
      };
    }
  }

  // Auto insert number fields with prefilled values.
  if (field.type === FieldType.NUMBER) {
    const { value } = ZNumberFieldMeta.parse(field.fieldMeta);

    if (value) {
      return {
        fieldId,
        customText: value,
      };
    }
  }

  // Auto insert radio fields with the pre-checked value.
  if (field.type === FieldType.RADIO) {
    const { values = [] } = ZRadioFieldMeta.parse(field.fieldMeta);

    const checkedItemIndex = values.findIndex((value) => value.checked);

    if (checkedItemIndex !== -1) {
      return {
        fieldId,
        customText: toRadioCustomText(checkedItemIndex),
      };
    }
  }

  // Auto insert dropdown fields with the default value.
  if (field.type === FieldType.DROPDOWN) {
    const { defaultValue, values = [] } = ZDropdownFieldMeta.parse(field.fieldMeta);

    if (defaultValue && values.some((value) => value.value === defaultValue)) {
      return {
        fieldId,
        customText: defaultValue,
      };
    }
  }

  // Auto insert checkbox fields with the pre-checked values.
  if (field.type === FieldType.CHECKBOX) {
    const {
      values = [],
      validationRule,
      validationLength,
    } = ZCheckboxFieldMeta.parse(field.fieldMeta);

    const checkedIndices: number[] = [];

    values.forEach((value, i) => {
      if (value.checked) {
        checkedIndices.push(i);
      }
    });

    let isValid = true;

    if (validationRule && validationLength) {
      const validation = checkboxValidationSigns.find((sign) => sign.label === validationRule);

      if (!validation) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Invalid checkbox validation rule',
        });
      }

      isValid = validateCheckboxLength(checkedIndices.length, validation.value, validationLength);
    }

    if (isValid && checkedIndices.length > 0) {
      return {
        fieldId,
        customText: toCheckboxCustomText(checkedIndices),
      };
    }
  }

  return null;
};
