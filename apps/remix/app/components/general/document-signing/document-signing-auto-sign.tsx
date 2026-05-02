import { useEffect, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { FieldType, type Field, type Recipient } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { match } from 'ts-pattern';

import { AUTO_SIGNABLE_FIELD_TYPES } from '@documenso/lib/constants/autosign';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Form } from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

import { useDocumentSigningContext } from './document-signing-provider';
import { useEnvelopeSigningContext } from './envelope-signing-provider';

// Note: Auto-signing only targets non-signature fields (NAME/INITIALS/EMAIL/DATE).
// Action auth applies to signatures only; see `validateFieldAuth` server-side.

// The threshold for the number of fields that could be autosigned before displaying the dialog
//
// Reasoning: If there aren't that many fields, it's likely going to be easier to manually sign each one
// while for larger documents with many fields it will be beneficial to sign away the boilerplate fields.
const AUTO_SIGN_THRESHOLD = 5;

export type DocumentSigningAutoSignProps = {
  recipient: Pick<Recipient, 'id' | 'token'>;
  fields: Field[];
  fullName?: string;
  email?: string;
};

export const DocumentSigningAutoSign = ({
  recipient,
  fields,
  fullName: fullNameProp,
  email: emailProp,
}: DocumentSigningAutoSignProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  // V1 context (document signing)
  const documentSigningContext = useDocumentSigningContext();
  // V2 context (envelope signing)
  const envelopeSigningContext = useEnvelopeSigningContext();

  const fullName = fullNameProp ?? envelopeSigningContext?.fullName ?? documentSigningContext?.fullName ?? '';
  const email = emailProp ?? envelopeSigningContext?.email ?? documentSigningContext?.email ?? '';

  const [open, setOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  const form = useForm();

  // V1 uses signFieldWithToken mutation directly
  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation();

  // V2 uses signField from envelope signing context (updates local state properly)
  const signFieldV2 = envelopeSigningContext?.signField;

  const autoSignableFields = fields.filter((field) => {
    if (field.inserted) {
      return false;
    }

    if (!AUTO_SIGNABLE_FIELD_TYPES.includes(field.type)) {
      return false;
    }

    if (field.type === FieldType.NAME && !fullName) {
      return false;
    }

    if (field.type === FieldType.INITIALS && !fullName) {
      return false;
    }

    if (field.type === FieldType.EMAIL && !email) {
      return false;
    }

    return true;
  });

  const onSubmit = async () => {
    const results = await Promise.allSettled(
      autoSignableFields.map(async (field) => {
        // Use V2 signing method if available (updates local state immediately)
        if (signFieldV2) {
          // V2 expects FieldType enum and different value types per field
          // We know field.type is one of AUTO_SIGNABLE_FIELD_TYPES, so we can safely match
          if (field.type === FieldType.NAME) {
            if (!fullName) {
              throw new Error('No value to sign');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await signFieldV2(field.id, { type: FieldType.NAME, value: fullName } as any);
          }

          if (field.type === FieldType.INITIALS) {
            const initials = extractInitials(fullName);
            if (!initials) {
              throw new Error('No value to sign');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await signFieldV2(field.id, { type: FieldType.INITIALS, value: initials } as any);
          }

          if (field.type === FieldType.EMAIL) {
            if (!email) {
              throw new Error('No value to sign');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await signFieldV2(field.id, { type: FieldType.EMAIL, value: email } as any);
          }

          if (field.type === FieldType.DATE) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await signFieldV2(field.id, { type: FieldType.DATE, value: true } as any);
          }

          // This should never happen since we filter autoSignableFields, but TypeScript needs this
          throw new Error(`Unsupported field type for auto-sign: ${field.type}`);
        }

        // Fallback to V1 method
        const value = match(field.type)
          .with(FieldType.NAME, () => fullName)
          .with(FieldType.INITIALS, () => extractInitials(fullName))
          .with(FieldType.EMAIL, () => email)
          .with(FieldType.DATE, () => new Date().toISOString())
          .otherwise(() => '');

        if (!value) {
          throw new Error('No value to sign');
        }

        // Fallback to V1 method
        return await signFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
          value,
          isBase64: false,
        });
      }),
    );

    if (results.some((result) => result.status === 'rejected')) {
      toast({
        title: _(msg`Error`),
        description: _(
          msg`An error occurred while auto-signing the document, some fields may not be signed. Please review and manually sign any remaining fields.`,
        ),
        duration: 5000,
        variant: 'destructive',
      });
    }

    // V1 needs revalidation to refresh loader data
    if (!signFieldV2) {
      await revalidate();
    }

    setOpen(false);
  };

  useEffect(() => {
    if (hasAutoOpenedRef.current) {
      return;
    }

    // console.log('autoSignableFields', autoSignableFields);
    // console.log('AUTO_SIGN_THRESHOLD', AUTO_SIGN_THRESHOLD);

    if (autoSignableFields.length <= AUTO_SIGN_THRESHOLD) {
      return;
    }

    hasAutoOpenedRef.current = true;
    setOpen(true);
  }, [autoSignableFields.length]);

  return (
    <>
      {!open && autoSignableFields.length > AUTO_SIGN_THRESHOLD && (
        <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
          <Button
            type="button"
            className="shadow-lg"
            onClick={() => {
              hasAutoOpenedRef.current = true;
              setOpen(true);
            }}
          >
            <Trans>Auto-sign fields</Trans>
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Automatically sign fields</Trans>
          </DialogTitle>
        </DialogHeader>

        <div className="max-w-[50ch] text-muted-foreground">
          <p>
            <Trans>
              When you sign a document, we can automatically fill in and sign the following fields
              using information that has already been provided. You can also manually sign or remove
              any automatically signed fields afterwards if you desire.
            </Trans>
          </p>

          <ul className="mt-4 flex list-inside list-disc flex-col gap-y-0.5">
            {AUTO_SIGNABLE_FIELD_TYPES.map((fieldType) => (
              <li key={fieldType}>
                <Trans>{_(FRIENDLY_FIELD_TYPE[fieldType as FieldType])}</Trans>
                <span className="pl-2 text-sm">
                  (
                  <Plural
                    value={autoSignableFields.filter((f) => f.type === fieldType).length}
                    one="1 matching field"
                    other="# matching fields"
                  />
                  )
                </span>
              </li>
            ))}
          </ul>
        </div>

        <DocumentSigningDisclosure className="mt-4" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogFooter className="flex w-full flex-1 flex-nowrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                className="min-w-[6rem]"
                loading={form.formState.isSubmitting}
                disabled={!autoSignableFields.length}
              >
                <Trans>Sign</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};
