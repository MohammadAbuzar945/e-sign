import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
} from '@prisma/client';
import { AnimatePresence, motion } from 'framer-motion';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import * as z from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { getRecipientsWithMissingFields } from '@documenso/lib/utils/recipients';
import { trpc, trpc as trpcReact } from '@documenso/trpc/react';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeDistributeDialogProps = {
  onDistribute?: () => Promise<void>;
  documentRootPath: string;
  trigger?: React.ReactNode;
};

export const ZEnvelopeDistributeFormSchema = z.object({
  meta: z.object({
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().email().optional(),
    ),
    subject: z.string(),
    message: z.string(),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
  }),
});

export type TEnvelopeDistributeFormSchema = z.infer<typeof ZEnvelopeDistributeFormSchema>;

export const EnvelopeDistributeDialog = ({
  trigger,
  documentRootPath,
  onDistribute,
}: EnvelopeDistributeDialogProps) => {
  const organisation = useCurrentOrganisation();

  const { envelope, syncEnvelope, isAutosaving, autosaveError } = useCurrentEnvelopeEditor();

  const { toast } = useToast();
  const { t } = useLingui();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { mutateAsync: distributeEnvelope } = trpcReact.envelope.distribute.useMutation();

  const { data: kbaConfig } = trpcReact.envelope.getKba.useQuery({
    envelopeId: envelope.id,
  });

  const form = useForm<TEnvelopeDistributeFormSchema>({
    defaultValues: {
      meta: {
        emailId: envelope.documentMeta?.emailId ?? null,
        emailReplyTo: envelope.documentMeta?.emailReplyTo || undefined,
        subject: envelope.documentMeta?.subject ?? '',
        message: envelope.documentMeta?.message ?? '',
        distributionMethod:
          envelope.documentMeta?.distributionMethod || DocumentDistributionMethod.EMAIL,
      },
    },
    resolver: zodResolver(ZEnvelopeDistributeFormSchema),
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = form;

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery({
      organisationId: organisation.id,
      perPage: 100,
    });

  const emails = emailData?.data || [];

  const distributionMethod = watch('meta.distributionMethod');

  const recipientsWithIndex = useMemo(
    () =>
      envelope.recipients.map((recipient, index) => ({
        ...recipient,
        index,
      })),
    [envelope.recipients],
  );

  const recipientsMissingSignatureFields = useMemo(
    () => getRecipientsWithMissingFields(recipientsWithIndex, envelope.fields),
    [recipientsWithIndex, envelope.fields],
  );

  /**
   * List of recipients who must have an email due to having auth enabled.
   */
  const recipientsMissingRequiredEmail = useMemo(() => {
    return recipientsWithIndex.filter((recipient) => {
      const auth = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      return (
        (auth.recipientAccessAuthRequired || auth.recipientActionAuthRequired) && !recipient.email
      );
    });
  }, [recipientsWithIndex, envelope.authOptions]);

  const isKbaSendBlocked = useMemo(() => {
    const auth = extractDocumentAuthMethods({
      documentAuth: envelope.authOptions,
    });

    if (!auth.documentAuthOption.globalAccessAuth.includes(DocumentAccessAuth.KBA)) {
      return false;
    }

    if (!kbaConfig?.settings?.isEnabled) {
      return true;
    }

    if (kbaConfig.settings.mode === 'PER_ENVELOPE') {
      const challenge = kbaConfig.envelopeChallenge;

      return (
        !challenge?.question?.trim() ||
        challenge.isAnswerConfigured !== true
      );
    }

    const recipientsNeedingChallenges = envelope.recipients.filter(
      (recipient) => recipient.role !== RecipientRole.CC,
    );

    for (const recipient of recipientsNeedingChallenges) {
      const challenge = kbaConfig.recipientChallenges.find((c) => c.recipientId === recipient.id);

      if (!challenge?.question?.trim() || challenge.isAnswerConfigured !== true) {
        return true;
      }
    }

    return false;
  }, [envelope.authOptions, envelope.recipients, kbaConfig]);

  const invalidEnvelopeCode = useMemo(() => {
    if (recipientsMissingSignatureFields.length > 0) {
      return 'MISSING_SIGNATURES';
    }

    if (envelope.recipients.length === 0) {
      return 'MISSING_RECIPIENTS';
    }

    if (recipientsMissingRequiredEmail.length > 0) {
      return 'MISSING_REQUIRED_EMAIL';
    }

    if (isKbaSendBlocked) {
      return 'KBA_INCOMPLETE';
    }

    return null;
  }, [
    envelope.recipients,
    isKbaSendBlocked,
    recipientsMissingRequiredEmail,
    recipientsMissingSignatureFields,
  ]);

  const onFormSubmit = async ({ meta }: TEnvelopeDistributeFormSchema) => {
    try {
      await distributeEnvelope({ envelopeId: envelope.id, meta });

      await onDistribute?.();

      const redirectPath = `${documentRootPath}/${envelope.id}`;

      await navigate(redirectPath);

      toast({
        title: t`Envelope distributed`,
        description: t`Your envelope has been distributed successfully.`,
        duration: 5000,
      });

      setIsOpen(false);
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`This envelope could not be distributed at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const handleSync = async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      await syncEnvelope();
    } catch (err) {
      console.error(err);
    }

    setIsSyncing(false);
  };

  useEffect(() => {
    // Resync the whole envelope if the envelope is mid saving.
    if (isOpen && (isAutosaving || autosaveError)) {
      void handleSync();
    }
  }, [isOpen]);

  // Reset form with current envelope document meta when dialog opens so that
  // subject/message/reply-to set in document settings are shown in the send dialog.
  useEffect(() => {
    if (isOpen) {
      form.reset({
        meta: {
          emailId: envelope.documentMeta?.emailId ?? null,
          emailReplyTo: envelope.documentMeta?.emailReplyTo || undefined,
          subject: envelope.documentMeta?.subject ?? '',
          message: envelope.documentMeta?.message ?? '',
          distributionMethod:
            envelope.documentMeta?.distributionMethod || DocumentDistributionMethod.EMAIL,
        },
      });
    }
  }, [isOpen]);

  if (envelope.status !== DocumentStatus.DRAFT || envelope.type !== EnvelopeType.DOCUMENT) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>
            <Trans>Send Document</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Recipients will be able to sign the document once sent</Trans>
          </DialogDescription>
        </DialogHeader>

        {!invalidEnvelopeCode || isSyncing ? (
          <Form {...form}>
            <form onSubmit={handleSubmit(onFormSubmit)}>
              <fieldset disabled={isSubmitting}>
                <div
                  className={cn('min-h-72', {
                    'min-h-[23rem]': organisation.organisationClaim.flags.emailDomains,
                  })}
                >
                  <AnimatePresence initial={false} mode="wait">
                    {isSyncing ? (
                      <motion.div
                        key={'Flushing'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        <SpinnerBox spinnerProps={{ size: 'sm' }} className="h-72" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key={'Emails'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        <Form {...form}>
                          <fieldset
                            className="mt-2 flex flex-col gap-y-4 rounded-lg"
                            disabled={form.formState.isSubmitting}
                          >
                            {organisation.organisationClaim.flags.emailDomains && (
                              <FormField
                                control={form.control}
                                name="meta.emailId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>Email Sender</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Select
                                        {...field}
                                        value={field.value === null ? '-1' : field.value}
                                        onValueChange={(value) =>
                                          field.onChange(value === '-1' ? null : value)
                                        }
                                      >
                                        <SelectTrigger
                                          loading={isLoadingEmails}
                                          className="bg-background"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                          {emails.map((email) => (
                                            <SelectItem key={email.id} value={email.id}>
                                              {email.email}
                                            </SelectItem>
                                          ))}

                                          <SelectItem value={'-1'}>Nomia</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>

                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={form.control}
                              name="meta.emailReplyTo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>
                                      Reply To Email{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} maxLength={254} />
                                  </FormControl>

                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.subject"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>
                                      Subject{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Input {...field} maxLength={255} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="meta.message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex flex-row items-center">
                                    <Trans>
                                      Message{' '}
                                      <span className="text-muted-foreground">(Optional)</span>
                                    </Trans>
                                    <Tooltip>
                                      <TooltipTrigger type="button">
                                        <InfoIcon className="mx-2 h-4 w-4" />
                                      </TooltipTrigger>
                                      <TooltipContent className="p-4 text-muted-foreground">
                                        <DocumentSendEmailMessageHelper />
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormLabel>

                                  <FormControl>
                                    <Textarea
                                      className="mt-2 h-16 resize-none bg-background"
                                      {...field}
                                      maxLength={5000}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </fieldset>
                        </Form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSubmitting}>
                      <Trans>Cancel</Trans>
                    </Button>
                  </DialogClose>

                  <Button loading={isSubmitting} disabled={isSyncing} type="submit">
                    <Trans>Send</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        ) : (
          <>
            <Alert variant="warning">
              {match(invalidEnvelopeCode)
                .with('MISSING_RECIPIENTS', () => (
                  <AlertDescription>
                    <Trans>You need at least one recipient to send a document</Trans>
                  </AlertDescription>
                ))
                .with('MISSING_SIGNATURES', () => (
                  <AlertDescription>
                    <Trans>The following signers are missing signature fields:</Trans>

                    <ul className="ml-2 mt-1 list-inside list-disc">
                      {recipientsMissingSignatureFields.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.email || recipient.name || t`Recipient ${recipient.index + 1}`}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                ))
                .with('MISSING_REQUIRED_EMAIL', () => (
                  <AlertDescription>
                    <Trans>The following recipients require an email address:</Trans>

                    <ul className="ml-2 mt-1 list-inside list-disc">
                      {recipientsMissingRequiredEmail.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.email || recipient.name || t`Recipient ${recipient.index + 1}`}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                ))
                .with('KBA_INCOMPLETE', () => (
                  <AlertDescription>
                    <Trans>
                      Security question (KBA) is turned on for this document, but the question,
                      answer, or multiple-choice options are not saved yet. Open Document Settings,
                      go to Security, finish KBA setup, then try sending again.
                    </Trans>
                  </AlertDescription>
                ))
                .exhaustive()}
            </Alert>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  <Trans>Close</Trans>
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
