import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import {
  DocumentDistributionMethod,
  DocumentVisibility,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  TemplateType,
} from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { InfoIcon, MailIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import {
  DOCUMENT_DISTRIBUTION_METHODS,
  DOCUMENT_SIGNATURE_TYPES,
} from '@documenso/lib/constants/document';
import { ZEnvelopeExpirationPeriod } from '@documenso/lib/constants/envelope-expiration';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '@documenso/lib/constants/i18n';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError } from '@documenso/lib/errors/app-error';
import {
  DocumentAccessAuth,
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
  ZDocumentAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentEmailSettingsSchema } from '@documenso/lib/types/document-email';
import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { normalizeStoredKbaSettings } from '@documenso/lib/utils/kba-settings';
import { isValidRedirectUrl } from '@documenso/lib/utils/is-valid-redirect-url';
import {
  DocumentSignatureType,
  canAccessTeamDocument,
  extractTeamSignatureSettings,
} from '@documenso/lib/utils/teams';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { DocumentEmailCheckboxes } from '@documenso/ui/components/document/document-email-checkboxes';
import {
  DocumentGlobalAuthAccessSelect,
  DocumentGlobalAuthAccessTooltip,
} from '@documenso/ui/components/document/document-global-auth-access-select';
import {
  DocumentGlobalAuthActionSelect,
  DocumentGlobalAuthActionTooltip,
} from '@documenso/ui/components/document/document-global-auth-action-select';
import { DocumentSendEmailMessageHelper } from '@documenso/ui/components/document/document-send-email-message-helper';
import { DocumentSignatureSettingsTooltip } from '@documenso/ui/components/document/document-signature-settings-tooltip';
import {
  DocumentVisibilitySelect,
  DocumentVisibilityTooltip,
} from '@documenso/ui/components/document/document-visibility-select';
import { ExpirationPeriodPicker } from '@documenso/ui/components/document/expiration-period-picker';
import {
  TemplateTypeSelect,
  TemplateTypeTooltip,
} from '@documenso/ui/components/template/template-type-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

const DOCUMENT_DISTRIBUTION_METHOD_SETTINGS_OPTIONS = Object.values(
  DOCUMENT_DISTRIBUTION_METHODS,
).filter(({ value }) => value !== DocumentDistributionMethod.NONE);

const ZKbaAnswerTypeSchema = z.enum(['STRING', 'NUMERIC', 'MCQ']);
const ZKbaModeSchema = z.enum(['PER_ENVELOPE', 'PER_RECIPIENT']);

const parseMcqOptions = (optionsInput?: string) => {
  if (!optionsInput) {
    return [];
  }

  return optionsInput
    .split(',')
    .map((option) => option.trim())
    .filter((option) => option.length > 0)
    .map((label) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      label,
    }))
    .filter((option) => option.key.length > 0);
};

export const ZAddSettingsFormSchema = z.object({
  templateType: z.nativeEnum(TemplateType).optional(),
  externalId: z.string().optional(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  includeQrCodeInCertificate: z.boolean().nullish(),
  globalAccessAuth: z
    .array(z.union([ZDocumentAccessAuthTypesSchema, z.literal('-1')]))
    .transform((val) => {
      if (val.includes('-1')) {
        return val.filter((entry) => entry !== '-1');
      }

      return val;
    })
    .optional()
    .default(['-1']),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional().default([]),
  kbaMode: ZKbaModeSchema.default('PER_ENVELOPE'),
  kbaMaxAttempts: z.number().int().min(1).max(20).default(5),
  kbaLockoutMinutes: z.number().int().min(1).max(1440).default(15),
  kbaAnswerType: ZKbaAnswerTypeSchema.default('STRING'),
  kbaApplySameToAllRecipients: z.boolean().default(true),
  kbaQuestion: z.string().optional(),
  kbaAnswer: z.string().optional(),
  kbaMcqOptions: z.string().optional(),
  kbaRecipientChallenges: z
    .array(
      z.object({
        recipientId: z.number(),
        recipientName: z.string(),
        recipientEmail: z.string(),
        question: z.string().optional(),
        answer: z.string().optional(),
      }),
    )
    .default([]),
  meta: z.object({
    subject: z.string(),
    message: z.string(),
    timezone: ZDocumentMetaTimezoneSchema.default(DEFAULT_DOCUMENT_TIME_ZONE),
    dateFormat: ZDocumentMetaDateFormatSchema.default(DEFAULT_DOCUMENT_DATE_FORMAT),
    distributionMethod: z
      .nativeEnum(DocumentDistributionMethod)
      .optional()
      .default(DocumentDistributionMethod.EMAIL),
    redirectUrl: z
      .string()
      .optional()
      .refine((value) => value === undefined || value === '' || isValidRedirectUrl(value), {
        message:
          'Please enter a valid URL, make sure you include http:// or https:// part of the url.',
      }),
    language: z
      .union([z.string(), z.enum(SUPPORTED_LANGUAGE_CODES)])
      .optional()
      .default('en'),
    emailId: z.string().nullable(),
    emailReplyTo: z.preprocess((val) => (val === '' ? undefined : val), zEmail().optional()),
    emailSettings: ZDocumentEmailSettingsSchema,
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullish(),
  }),
})
  .superRefine((value, ctx) => {
    const requiresKba = value.globalAccessAuth.includes(DocumentAccessAuth.KBA);

    if (!requiresKba) {
      return;
    }

    if (value.kbaMode === 'PER_ENVELOPE') {
      if (!value.kbaQuestion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg`Please enter a security question before saving.`.id,
          path: ['kbaQuestion'],
        });
      }

      if (!value.kbaAnswer?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg`Please enter the expected answer before saving.`.id,
          path: ['kbaAnswer'],
        });
      }
    }

    if (value.kbaMode === 'PER_RECIPIENT') {
      if (value.kbaApplySameToAllRecipients) {
        if (!value.kbaQuestion?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg`Please enter a security question before saving.`.id,
            path: ['kbaQuestion'],
          });
        }

        if (!value.kbaAnswer?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg`Please enter the expected answer before saving.`.id,
            path: ['kbaAnswer'],
          });
        }
      } else {
        value.kbaRecipientChallenges.forEach((challenge, index) => {
          if (!challenge.question?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: msg`Please enter a security question for this recipient.`.id,
              path: ['kbaRecipientChallenges', index, 'question'],
            });
          }

          if (!challenge.answer?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: msg`Please enter the expected answer for this recipient.`.id,
              path: ['kbaRecipientChallenges', index, 'answer'],
            });
          }
        });
      }
    }

    if (value.kbaAnswerType === 'NUMERIC') {
      const addNumericFormatIssue = (answer: string | undefined, path: (string | number)[]) => {
        const trimmed = answer?.trim() ?? '';

        if (!trimmed) {
          return;
        }

        if (!/^\d+$/.test(trimmed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg`Only digits (0-9) are allowed for a numeric answer.`.id,
            path,
          });
        }
      };

      if (value.kbaMode === 'PER_ENVELOPE') {
        addNumericFormatIssue(value.kbaAnswer, ['kbaAnswer']);
      }

      if (value.kbaMode === 'PER_RECIPIENT') {
        if (value.kbaApplySameToAllRecipients) {
          addNumericFormatIssue(value.kbaAnswer, ['kbaAnswer']);
        } else {
          value.kbaRecipientChallenges.forEach((challenge, index) => {
            addNumericFormatIssue(challenge.answer, ['kbaRecipientChallenges', index, 'answer']);
          });
        }
      }
    }

    if (value.kbaAnswerType === 'MCQ') {
      const parsedOptions = parseMcqOptions(value.kbaMcqOptions);

      if (parsedOptions.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg`Please provide at least 2 MCQ options`.id,
          path: ['kbaMcqOptions'],
        });
      }

      if (value.kbaMode === 'PER_RECIPIENT' && !value.kbaApplySameToAllRecipients) {
        value.kbaRecipientChallenges.forEach((challenge, index) => {
          const normalizedAnswer = challenge.answer?.trim().toLowerCase();
          const hasMatchingOption = parsedOptions.some(
            (option) => option.label.toLowerCase() === normalizedAnswer,
          );

          if (parsedOptions.length > 0 && normalizedAnswer && !hasMatchingOption) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: msg`Correct answer must match one of the MCQ options exactly`.id,
              path: ['kbaRecipientChallenges', index, 'answer'],
            });
          }
        });
      } else {
        const normalizedAnswer = value.kbaAnswer?.trim().toLowerCase();
        const hasMatchingOption = parsedOptions.some(
          (option) => option.label.toLowerCase() === normalizedAnswer,
        );

        if (parsedOptions.length > 0 && normalizedAnswer && !hasMatchingOption) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: msg`Correct answer must match one of the MCQ options exactly`.id,
            path: ['kbaAnswer'],
          });
        }
      }
    }
  });

type EnvelopeEditorSettingsTabType = 'general' | 'email' | 'security';

const tabs = [
  {
    id: 'general',
    title: msg`General`,
    icon: SettingsIcon,
    description: msg`Configure document settings and options before sending.`,
  },
  {
    id: 'email',
    title: msg`Email`,
    icon: MailIcon,
    description: msg`Configure email settings for the document.`,
  },
  {
    id: 'security',
    title: msg`Security`,
    icon: ShieldIcon,
    description: msg`Configure security settings for the document.`,
  },
] as const;

type TAddSettingsFormSchema = z.infer<typeof ZAddSettingsFormSchema>;

type TKbaAnswerCache = {
  answer?: string;
  recipientAnswers: Record<number, string>;
};

type EnvelopeEditorSettingsDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopeEditorSettingsDialog = ({
  trigger,
  ...props
}: EnvelopeEditorSettingsDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { envelope, updateEnvelopeAsync, editorConfig, isEmbedded, organisationEmails } =
    useCurrentEnvelopeEditor();

  const { settings } = editorConfig;

  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EnvelopeEditorSettingsTabType>('general');
  const [lastSavedKbaAnswers, setLastSavedKbaAnswers] = useState<TKbaAnswerCache>({
    answer: undefined,
    recipientAnswers: {},
  });

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const { data: envelopeKbaConfig, isLoading: isLoadingEnvelopeKbaConfig } =
    trpc.envelope.getKba.useQuery(
      {
        envelopeId: envelope.id,
      },
      {
        enabled: open,
      },
    );

  const { data: teamForKbaDefaults } = trpc.team.get.useQuery({
    teamReference: team.id,
  });

  const createDefaultValues = () => {
    const firstKbaChallenge =
      envelopeKbaConfig?.envelopeChallenge ?? envelopeKbaConfig?.recipientChallenges.at(0);
    const recipientChallengeById = new Map(
      (envelopeKbaConfig?.recipientChallenges ?? []).map((challenge) => [
        challenge.recipientId,
        challenge,
      ]),
    );
    const mcqOptions = firstKbaChallenge?.mcqOptions?.map((option) => option.label).join(', ') ?? '';

    const resolvedDistributionMethod =
      envelope.documentMeta.distributionMethod === DocumentDistributionMethod.NONE
        ? DocumentDistributionMethod.EMAIL
        : envelope.documentMeta.distributionMethod || DocumentDistributionMethod.EMAIL;
    const resolvedTemplateType =
      envelope.templateType === TemplateType.PUBLIC ? TemplateType.PUBLIC : TemplateType.PRIVATE;

    const authParsed = ZDocumentAuthOptionsSchema.parse(envelope.authOptions ?? {});
    const teamDerivedKba = normalizeStoredKbaSettings(
      teamForKbaDefaults?.derivedSettings?.kbaSettings,
    );
    const storedGlobalAccessAuth = [...(documentAuthOption?.globalAccessAuth || [])];
    let globalAccessAuthForForm = [...storedGlobalAccessAuth];
    if (
      teamDerivedKba.isEnabled &&
      !authParsed.kbaAccessExplicitlyDisabled &&
      !globalAccessAuthForForm.includes(DocumentAccessAuth.KBA)
    ) {
      globalAccessAuthForForm = [...globalAccessAuthForForm, DocumentAccessAuth.KBA];
    }

    return {
      templateType: resolvedTemplateType,
      externalId: envelope.externalId || '',
      visibility: envelope.visibility || '',
      includeQrCodeInCertificate: envelope.includeQrCodeInCertificate ?? null,
      globalAccessAuth: globalAccessAuthForForm,
      globalActionAuth: documentAuthOption?.globalActionAuth || [],
      kbaMode: envelopeKbaConfig?.settings?.mode ?? ('PER_ENVELOPE' as const),
      kbaMaxAttempts: envelopeKbaConfig?.settings?.maxAttempts ?? teamDerivedKba.maxAttempts,
      kbaLockoutMinutes:
        envelopeKbaConfig?.settings?.lockoutMinutes ?? teamDerivedKba.lockoutMinutes,
      kbaAnswerType: firstKbaChallenge?.answerType ?? ('STRING' as const),
      kbaApplySameToAllRecipients: (envelopeKbaConfig?.settings?.mode ?? 'PER_ENVELOPE') === 'PER_ENVELOPE',
      kbaQuestion: envelopeKbaConfig?.envelopeChallenge?.question ?? '',
      kbaAnswer:
        lastSavedKbaAnswers.answer ??
        envelopeKbaConfig?.envelopeChallenge?.answer ??
        envelopeKbaConfig?.recipientChallenges.at(0)?.answer ??
        '',
      kbaMcqOptions: mcqOptions,
      kbaRecipientChallenges: envelope.recipients.map((recipient) => ({
        recipientId: recipient.id,
        recipientName: recipient.name ?? '',
        recipientEmail: recipient.email,
        question: recipientChallengeById.get(recipient.id)?.question ?? '',
        answer:
          lastSavedKbaAnswers.recipientAnswers[recipient.id] ??
          recipientChallengeById.get(recipient.id)?.answer ??
          '',
      })),
      meta: {
        subject: envelope.documentMeta.subject ?? '',
        message: envelope.documentMeta.message ?? '',
        timezone: envelope.documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        dateFormat: (envelope.documentMeta.dateFormat ??
          DEFAULT_DOCUMENT_DATE_FORMAT) as TDocumentMetaDateFormat,
        distributionMethod: resolvedDistributionMethod,
        redirectUrl: envelope.documentMeta.redirectUrl ?? '',
        language: envelope.documentMeta.language ?? 'en',
        emailId: envelope.documentMeta.emailId ?? null,
        emailReplyTo: envelope.documentMeta.emailReplyTo ?? undefined,
        emailSettings: ZDocumentEmailSettingsSchema.parse(envelope.documentMeta.emailSettings),
        signatureTypes: extractTeamSignatureSettings(envelope.documentMeta),
        envelopeExpirationPeriod: envelope.documentMeta?.envelopeExpirationPeriod ?? null,
      },
    };
  };

  const form = useForm<TAddSettingsFormSchema>({
    resolver: zodResolver(ZAddSettingsFormSchema),
    defaultValues: createDefaultValues(),
  });

  const envelopeHasBeenSent =
    envelope.type === EnvelopeType.DOCUMENT &&
    envelope.recipients.some(
      (recipient) =>
        recipient.role !== RecipientRole.CC && recipient.sendStatus === SendStatus.SENT,
    );

  const emailSettings = form.watch('meta.emailSettings');

  const { data: emailData, isLoading: isLoadingEmails } =
    trpc.enterprise.organisation.email.find.useQuery(
      {
        organisationId: organisation.id,
        perPage: 100,
      },
      {
        ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
        enabled: Boolean(organisationEmails !== undefined && organisation.id),
      },
    );

  const emails = emailData?.data || organisationEmails || [];

  const canUpdateVisibility = canAccessTeamDocument(team.currentTeamRole, envelope.visibility);
  const requiresKba = form.watch('globalAccessAuth').includes(DocumentAccessAuth.KBA);
  const kbaMode = form.watch('kbaMode');
  const kbaAnswerType = form.watch('kbaAnswerType');
  const kbaApplySameToAllRecipients = form.watch('kbaApplySameToAllRecipients');
  const updateEnvelopeKbaMutation = trpc.envelope.updateKba.useMutation();

  const onFormSubmit = async (data: TAddSettingsFormSchema) => {
    const {
      timezone,
      dateFormat,
      redirectUrl,
      language,
      signatureTypes,
      distributionMethod,
      emailId,
      emailSettings,
      message,
      subject,
      emailReplyTo,
      envelopeExpirationPeriod,
    } = data.meta;

    const parsedGlobalAccessAuth = z
      .array(ZDocumentAccessAuthTypesSchema)
      .safeParse(data.globalAccessAuth);

    const teamKbaDefaultEnabled = normalizeStoredKbaSettings(
      teamForKbaDefaults?.derivedSettings?.kbaSettings,
    ).isEnabled;
    const kbaAccessExplicitlyDisabled =
      teamKbaDefaultEnabled &&
      parsedGlobalAccessAuth.success &&
      !parsedGlobalAccessAuth.data.includes(DocumentAccessAuth.KBA);

    try {
      await updateEnvelopeAsync({
        data: {
          templateType: envelope.type === EnvelopeType.TEMPLATE ? data.templateType : undefined,
          externalId: data.externalId || null,
          visibility: data.visibility,
          includeQrCodeInCertificate: data.includeQrCodeInCertificate,
          globalAccessAuth: parsedGlobalAccessAuth.success ? parsedGlobalAccessAuth.data : [],
          globalActionAuth: data.globalActionAuth ?? [],
          ...(teamKbaDefaultEnabled
            ? {
                kbaAccessExplicitlyDisabled,
              }
            : {}),
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
          emailId,
          message,
          subject,
          emailReplyTo,
          emailSettings,
          distributionMethod,
          language: isValidLanguageCode(language) ? language : undefined,
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          envelopeExpirationPeriod,
        },
      });

      if (parsedGlobalAccessAuth.success) {
        const accessAuth = parsedGlobalAccessAuth.data;

        if (accessAuth.includes(DocumentAccessAuth.KBA)) {
          const parsedOptions = parseMcqOptions(data.kbaMcqOptions);
          const mcqAnswerOption = parsedOptions.find(
            (option) => option.label.toLowerCase() === data.kbaAnswer?.trim().toLowerCase(),
          );
          const recipientChallenges = data.kbaRecipientChallenges.map((challenge) => {
            const effectiveQuestion = data.kbaApplySameToAllRecipients
              ? (data.kbaQuestion?.trim() ?? '')
              : (challenge.question?.trim() ?? '');
            const effectiveAnswer = data.kbaApplySameToAllRecipients
              ? (data.kbaAnswer?.trim() ?? '')
              : (challenge.answer?.trim() ?? '');

            const recipientMcqAnswerOption = parsedOptions.find(
              (option) => option.label.toLowerCase() === effectiveAnswer.toLowerCase(),
            );

            return {
              recipientId: challenge.recipientId,
              answerType: data.kbaAnswerType,
              question: effectiveQuestion,
              answer:
                data.kbaAnswerType === 'MCQ'
                  ? (recipientMcqAnswerOption?.key ?? '')
                  : effectiveAnswer,
              mcqOptions: data.kbaAnswerType === 'MCQ' ? parsedOptions : undefined,
            };
          });

          await updateEnvelopeKbaMutation.mutateAsync({
            envelopeId: envelope.id,
            settings: {
              mode: data.kbaMode,
              isEnabled: true,
              maxAttempts: data.kbaMaxAttempts,
              lockoutMinutes: data.kbaLockoutMinutes,
            },
            envelopeChallenge:
              data.kbaMode === 'PER_ENVELOPE'
                ? {
                    answerType: data.kbaAnswerType,
                    question: data.kbaQuestion?.trim() ?? '',
                    answer:
                      data.kbaAnswerType === 'MCQ'
                        ? (mcqAnswerOption?.key ?? '')
                        : (data.kbaAnswer?.trim() ?? ''),
                    mcqOptions: data.kbaAnswerType === 'MCQ' ? parsedOptions : undefined,
                  }
                : null,
            recipientChallenges: data.kbaMode === 'PER_RECIPIENT' ? recipientChallenges : [],
          });

          setLastSavedKbaAnswers({
            answer:
              data.kbaMode === 'PER_ENVELOPE' || data.kbaApplySameToAllRecipients
                ? (data.kbaAnswer?.trim() ?? '')
                : undefined,
            recipientAnswers:
              data.kbaMode === 'PER_RECIPIENT' && !data.kbaApplySameToAllRecipients
                ? Object.fromEntries(
                    data.kbaRecipientChallenges.map((challenge) => [
                      challenge.recipientId,
                      challenge.answer?.trim() ?? '',
                    ]),
                  )
                : {},
          });
        } else {
          await updateEnvelopeKbaMutation.mutateAsync({
            envelopeId: envelope.id,
            settings: {
              mode: 'PER_ENVELOPE',
              isEnabled: false,
              maxAttempts: data.kbaMaxAttempts,
              lockoutMinutes: data.kbaLockoutMinutes,
            },
            envelopeChallenge: null,
            recipientChallenges: [],
          });
        }
      }

      setOpen(false);

      if (!isEmbedded) {
        toast({
          title: t`Success`,
          description: t`Envelope updated`,
          duration: 5000,
        });
      }
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to update the envelope. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (
      !form.formState.touchedFields.meta?.timezone &&
      !envelopeHasBeenSent &&
      !envelope.documentMeta.timezone
    ) {
      form.setValue('meta.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [
    envelopeHasBeenSent,
    form,
    form.setValue,
    form.formState.touchedFields.meta?.timezone,
    envelope.documentMeta.timezone,
  ]);

  useEffect(() => {
    if (!open || isLoadingEnvelopeKbaConfig) {
      return;
    }

    form.reset(createDefaultValues());
    setActiveTab('general');
  }, [open, isLoadingEnvelopeKbaConfig, envelopeKbaConfig, teamForKbaDefaults, form]);

  const selectedTab = tabs.find((tab) => tab.id === activeTab);

  if (!selectedTab || !settings) {
    return null;
  }

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Settings</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex w-full !max-w-5xl flex-row gap-0 p-0">
        {/* Sidebar. */}
        <div className="flex w-80 flex-col border-r bg-accent/20">
          <DialogHeader className="p-6 pb-4" data-testid="envelope-editor-settings-dialog-header">
            <DialogTitle>
              <Trans>Document Settings</Trans>
            </DialogTitle>
          </DialogHeader>

          <nav className="col-span-12 mb-8 flex flex-wrap items-center justify-start gap-x-2 gap-y-4 px-4 md:col-span-3 md:w-full md:flex-col md:items-start md:gap-y-2">
            {tabs.map((tab) => {
              if (tab.id === 'email' && !settings.allowConfigureDistribution) {
                return null;
              }

              return (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  variant="ghost"
                  className={cn('w-full justify-start', {
                    'bg-secondary': activeTab === tab.id,
                  })}
                >
                  <tab.icon className="mr-2 h-5 w-5" />
                  {t(tab.title)}
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Content. */}
        <div className="flex w-full flex-col">
          <CardHeader className="border-b pb-4">
            <CardTitle>{selectedTab ? t(selectedTab.title) : ''}</CardTitle>
            <CardDescription>{selectedTab ? t(selectedTab.description) : ''}</CardDescription>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset
                className="flex h-[45rem] max-h-[calc(100vh-14rem)] w-full flex-col space-y-6 overflow-y-auto px-6 py-6"
                disabled={form.formState.isSubmitting}
                key={activeTab}
              >
                {match({ activeTab, settings })
                  .with({ activeTab: 'general' }, () => (
                    <>
                      {settings.allowConfigureLanguage && (
                        <FormField
                          control={form.control}
                          name="meta.language"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="inline-flex items-center">
                                <Trans>Language</Trans>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
                                    <Trans>
                                      Controls the language for the document, including the language
                                      to be used for email notifications, and the final certificate
                                      that is generated and attached to the document.
                                    </Trans>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>

                              <FormControl>
                                <Select
                                  value={field.value}
                                  disabled={field.disabled}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="bg-background">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent>
                                    {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
                                      <SelectItem key={code} value={code}>
                                        {t(language.full)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {settings.allowConfigureSignatureTypes && (
                        <FormField
                          control={form.control}
                          name="meta.signatureTypes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Allowed Signature Types</Trans>
                                <DocumentSignatureSettingsTooltip />
                              </FormLabel>

                              <FormControl>
                                <MultiSelectCombobox
                                  options={Object.values(DOCUMENT_SIGNATURE_TYPES).map(
                                    (option) => ({
                                      label: t(option.label),
                                      value: option.value,
                                    }),
                                  )}
                                  selectedValues={field.value}
                                  onChange={field.onChange}
                                  className="w-full bg-background"
                                  emptySelectionPlaceholder="Select signature types"
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {settings.allowConfigureDateFormat && (
                        <FormField
                          control={form.control}
                          name="meta.dateFormat"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>Date Format</Trans>
                              </FormLabel>

                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={envelopeHasBeenSent}
                                >
                                  <SelectTrigger className="bg-background">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent>
                                    {DATE_FORMATS.map((format) => (
                                      <SelectItem key={format.key} value={format.value}>
                                        {format.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {settings.allowConfigureTimezone && (
                        <FormField
                          control={form.control}
                          name="meta.timezone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>Time Zone</Trans>
                              </FormLabel>

                              <FormControl>
                                <Combobox
                                  className="bg-background"
                                  options={TIME_ZONES}
                                  value={field.value}
                                  onChange={(value) => value && field.onChange(value)}
                                  disabled={envelopeHasBeenSent}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="externalId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex flex-row items-center">
                              <Trans>External ID</Trans>{' '}
                              <Tooltip>
                                <TooltipTrigger>
                                  <InfoIcon className="mx-2 h-4 w-4" />
                                </TooltipTrigger>

                                <TooltipContent className="max-w-xs text-muted-foreground">
                                  <Trans>
                                    Add an external ID to the document. This can be used to identify
                                    the document in external systems.
                                  </Trans>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>

                            <FormControl>
                              <Input className="bg-background" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="meta.redirectUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex flex-row items-center">
                              <Trans>Redirect URL</Trans>{' '}
                              <Tooltip>
                                <TooltipTrigger>
                                  <InfoIcon className="mx-2 h-4 w-4" />
                                </TooltipTrigger>

                                <TooltipContent className="max-w-xs text-muted-foreground">
                                  <Trans>
                                    Add a URL to redirect the user to once the document is signed
                                  </Trans>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>

                            <FormControl>
                              <Input className="bg-background" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {envelope.type === EnvelopeType.TEMPLATE && (
                        <FormField
                          control={form.control}
                          name="templateType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Template type</Trans>
                                <TemplateTypeTooltip
                                  organisationTeamCount={organisation.teams.length}
                                />
                              </FormLabel>

                              <FormControl>
                                <TemplateTypeSelect
                                  value={field.value}
                                  disabled={field.disabled}
                                  onValueChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      {settings.allowConfigureDistribution && (
                        <FormField
                          control={form.control}
                          name="meta.distributionMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Document Distribution Method</Trans>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
                                    <h2>
                                      <strong>
                                        <Trans>Document Distribution Method</Trans>
                                      </strong>
                                    </h2>

                                    <p>
                                      <Trans>
                                        This is how the document will reach the recipients once the
                                        document is ready for signing.
                                      </Trans>
                                    </p>

                                    <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
                                      <li>
                                        <Trans>
                                          <strong>Email</strong> - The recipient will be emailed the
                                          document to sign, approve, etc.
                                        </Trans>
                                      </li>
                                      <li>
                                        <Trans>
                                          <strong>None</strong> - We will generate links which you
                                          can send to the recipients manually.
                                        </Trans>
                                      </li>
                                    </ul>

                                    <Trans>
                                      <strong>Note</strong> - If you use Links in combination with
                                      direct templates, you will need to manually send the links to
                                      the remaining recipients.
                                    </Trans>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>

                              <FormControl>
                                <Select {...field} onValueChange={field.onChange}>
                                  <SelectTrigger className="bg-background text-muted-foreground">
                                    <SelectValue data-testid="documentDistributionMethodSelectValue" />
                                  </SelectTrigger>

                                  <SelectContent position="popper">
                                    {Object.values(DOCUMENT_DISTRIBUTION_METHODS).map(
                                      ({ value, description }) => (
                                        <SelectItem key={value} value={value}>
                                          {t(description)}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      {settings.allowConfigureExpirationPeriod && (
                        <FormField
                          control={form.control}
                          name="meta.envelopeExpirationPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Expiration</Trans>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>

                                  <TooltipContent className="max-w-xs text-muted-foreground">
                                    <Trans>
                                      How long recipients have to complete this document after it is
                                      sent. Uses the team default when set to inherit.
                                    </Trans>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>

                              <FormControl>
                                <ExpirationPeriodPicker
                                  value={field.value}
                                  onChange={field.onChange}
                                  disabled={envelopeHasBeenSent}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  ))
                  .with(
                    { activeTab: 'email', settings: { allowConfigureDistribution: true } },
                    () => (
                      <>
                        {settings.allowConfigureEmailSender &&
                          organisation.organisationClaim.flags.emailDomains && (
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

                        {settings.allowConfigureEmailReplyTo && (
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
                                  <Input {...field} />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name="meta.subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>
                                  Subject <span className="text-muted-foreground">(Optional)</span>
                                </Trans>
                              </FormLabel>

                              <FormControl>
                                <Input {...field} />
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
                                  Message <span className="text-muted-foreground">(Optional)</span>
                                </Trans>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <InfoIcon className="mx-2 h-4 w-4" />
                                  </TooltipTrigger>
                                  <TooltipContent className="p-4 text-muted-foreground">
                                    <DocumentSendEmailMessageHelper />
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>

                              <FormControl>
                                <Textarea className="h-16 resize-none bg-background" {...field} />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DocumentEmailCheckboxes
                          value={emailSettings}
                          onChange={(value) => form.setValue('meta.emailSettings', value)}
                        />
                      </>
                    ),
                  )
                  .with({ activeTab: 'security' }, () => (
                    <>
                      {organisation.organisationClaim.flags.cfr21 && (
                        <FormField
                          control={form.control}
                          name="globalActionAuth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex flex-row items-center">
                                <Trans>Recipient action authentication</Trans>
                                <DocumentGlobalAuthActionTooltip />
                              </FormLabel>

                              <FormControl>
                                <DocumentGlobalAuthActionSelect
                                  value={field.value}
                                  disabled={field.disabled}
                                  onValueChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="globalAccessAuth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex flex-row items-center">
                              <Trans>Document access</Trans>
                              <DocumentGlobalAuthAccessTooltip />
                            </FormLabel>

                            <FormControl>
                              <DocumentGlobalAuthAccessSelect
                                value={field.value}
                                disabled={field.disabled}
                                onValueChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {requiresKba && (
                        <>
                          <FormField
                            control={form.control}
                            name="kbaMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>KBA Mode</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={(value) => field.onChange(value)}
                                  >
                                    <SelectTrigger className="bg-background">
                                      <SelectValue />
                                    </SelectTrigger>

                                    <SelectContent>
                                      <SelectItem value="PER_ENVELOPE">
                                        <Trans>Per Envelope</Trans>
                                      </SelectItem>
                                      <SelectItem value="PER_RECIPIENT">
                                        <Trans>Per Recipient</Trans>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="kbaAnswerType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  <Trans>KBA Answer Type</Trans>
                                </FormLabel>

                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={(value) => field.onChange(value)}
                                  >
                                    <SelectTrigger className="bg-background">
                                      <SelectValue />
                                    </SelectTrigger>

                                    <SelectContent>
                                      <SelectItem value="STRING">
                                        <Trans>Text</Trans>
                                      </SelectItem>
                                      <SelectItem value="NUMERIC">
                                        <Trans>Numeric</Trans>
                                      </SelectItem>
                                      <SelectItem value="MCQ">
                                        <Trans>MCQ</Trans>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="kbaMaxAttempts"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Max attempts</Trans>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={Number.isFinite(field.value) ? String(field.value) : ''}
                                      onChange={(e) => {
                                        const next = Number.parseInt(e.target.value, 10);
                                        field.onChange(Number.isFinite(next) ? next : 1);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="kbaLockoutMinutes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>Lockout (minutes)</Trans>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={1440}
                                      value={Number.isFinite(field.value) ? String(field.value) : ''}
                                      onChange={(e) => {
                                        const next = Number.parseInt(e.target.value, 10);
                                        field.onChange(Number.isFinite(next) ? next : 1);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {kbaAnswerType === 'MCQ' && (
                            <FormField
                              control={form.control}
                              name="kbaMcqOptions"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    <Trans>MCQ Options</Trans>
                                  </FormLabel>

                                  <FormControl>
                                    <Input
                                      className="bg-background"
                                      placeholder={t`e.g. Red, Blue, Green`}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {kbaMode === 'PER_ENVELOPE' ? (
                            <>
                              <FormField
                                control={form.control}
                                name="kbaQuestion"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>KBA Question</Trans>
                                    </FormLabel>

                                    <FormControl>
                                      <Input
                                        className="bg-background"
                                        placeholder={t`e.g. What is your employee code?`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="kbaAnswer"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>KBA Answer</Trans>
                                    </FormLabel>

                                    <FormControl>
                                      <PasswordInput
                                        className="bg-background"
                                        inputMode={
                                          kbaAnswerType === 'NUMERIC' ? 'numeric' : undefined
                                        }
                                        placeholder={
                                          kbaAnswerType === 'NUMERIC'
                                            ? t`Digits only (e.g. 1234)`
                                            : kbaAnswerType === 'MCQ'
                                              ? t`Enter the correct option exactly`
                                              : t`Enter the expected answer`
                                        }
                                        name={field.name}
                                        ref={field.ref}
                                        value={field.value ?? ''}
                                        onBlur={field.onBlur}
                                        onChange={
                                          kbaAnswerType === 'NUMERIC'
                                            ? (e) =>
                                                field.onChange(e.target.value.replace(/\D/g, ''))
                                            : field.onChange
                                        }
                                      />
                                    </FormControl>
                                    {kbaAnswerType === 'NUMERIC' ? (
                                      <FormDescription>
                                        <Trans>Only numbers are allowed—letters and symbols are removed.</Trans>
                                      </FormDescription>
                                    ) : null}
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          ) : (
                            <div className="space-y-3">
                              <FormField
                                control={form.control}
                                name="kbaApplySameToAllRecipients"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      <Trans>Use same question and answer for all recipients</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Select
                                        value={field.value ? 'yes' : 'no'}
                                        onValueChange={(value) => field.onChange(value === 'yes')}
                                      >
                                        <SelectTrigger className="bg-background">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="yes">
                                            <Trans>Yes</Trans>
                                          </SelectItem>
                                          <SelectItem value="no">
                                            <Trans>No (configure each recipient separately)</Trans>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {kbaApplySameToAllRecipients && (
                                <>
                                  <FormField
                                    control={form.control}
                                    name="kbaQuestion"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          <Trans>Common KBA Question</Trans>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            className="bg-background"
                                            placeholder={t`e.g. What is your employee code?`}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name="kbaAnswer"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          <Trans>Common KBA Answer</Trans>
                                        </FormLabel>
                                        <FormControl>
                                          <PasswordInput
                                            className="bg-background"
                                            inputMode={
                                              kbaAnswerType === 'NUMERIC' ? 'numeric' : undefined
                                            }
                                            placeholder={
                                              kbaAnswerType === 'NUMERIC'
                                                ? t`Digits only (e.g. 1234)`
                                                : kbaAnswerType === 'MCQ'
                                                  ? t`Enter the correct option exactly`
                                                  : t`Enter the expected answer`
                                            }
                                            name={field.name}
                                            ref={field.ref}
                                            value={field.value ?? ''}
                                            onBlur={field.onBlur}
                                            onChange={
                                              kbaAnswerType === 'NUMERIC'
                                                ? (e) =>
                                                    field.onChange(
                                                      e.target.value.replace(/\D/g, ''),
                                                    )
                                                : field.onChange
                                            }
                                          />
                                        </FormControl>
                                        {kbaAnswerType === 'NUMERIC' ? (
                                          <FormDescription>
                                            <Trans>
                                              Only numbers are allowed—letters and symbols are
                                              removed.
                                            </Trans>
                                          </FormDescription>
                                        ) : null}
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </>
                              )}

                              {envelope.recipients.map((recipient, index) => (
                                <div key={recipient.id} className="space-y-3 rounded-md border p-3">
                                  <p className="text-sm font-bold">
                                    {recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email}
                                  </p>

                                  <FormField
                                    control={form.control}
                                    name={`kbaRecipientChallenges.${index}.question`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          <Trans>KBA Question</Trans>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            className="bg-background"
                                            placeholder={t`e.g. What is your employee code?`}
                                            disabled={kbaApplySameToAllRecipients}
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`kbaRecipientChallenges.${index}.answer`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          <Trans>KBA Answer</Trans>
                                        </FormLabel>
                                        <FormControl>
                                          <PasswordInput
                                            className="bg-background"
                                            inputMode={
                                              kbaAnswerType === 'NUMERIC' ? 'numeric' : undefined
                                            }
                                            placeholder={
                                              kbaAnswerType === 'NUMERIC'
                                                ? t`Digits only (e.g. 1234)`
                                                : kbaAnswerType === 'MCQ'
                                                  ? t`Enter the correct option exactly`
                                                  : t`Enter the expected answer`
                                            }
                                            disabled={kbaApplySameToAllRecipients}
                                            name={field.name}
                                            ref={field.ref}
                                            value={field.value ?? ''}
                                            onBlur={field.onBlur}
                                            onChange={
                                              kbaAnswerType === 'NUMERIC'
                                                ? (e) =>
                                                    field.onChange(
                                                      e.target.value.replace(/\D/g, ''),
                                                    )
                                                : field.onChange
                                            }
                                          />
                                        </FormControl>
                                        {kbaAnswerType === 'NUMERIC' &&
                                        !kbaApplySameToAllRecipients ? (
                                          <FormDescription>
                                            <Trans>
                                              Only numbers are allowed—letters and symbols are
                                              removed.
                                            </Trans>
                                          </FormDescription>
                                        ) : null}
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      <FormField
                        control={form.control}
                        name="includeQrCodeInCertificate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Include QR code in certificate</Trans>
                            </FormLabel>

                            <FormControl>
                              <Select
                                value={field.value == null ? '-1' : String(field.value)}
                                onValueChange={(value) =>
                                  field.onChange(value === '-1' ? null : value === 'true')
                                }
                              >
                                <SelectTrigger className="bg-background text-muted-foreground">
                                  <SelectValue placeholder={t`Inherit from team`} />
                                </SelectTrigger>

                                <SelectContent>
                                  <SelectItem value="true">
                                    <Trans>Yes</Trans>
                                  </SelectItem>
                                  <SelectItem value="false">
                                    <Trans>No</Trans>
                                  </SelectItem>
                                  <SelectItem value="-1">
                                    <Trans>Inherit from team</Trans>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="visibility"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex flex-row items-center">
                              <Trans>Document visibility</Trans>
                              <DocumentVisibilityTooltip />
                            </FormLabel>

                              <FormControl>
                                <DocumentVisibilitySelect
                                  canUpdateVisibility={canUpdateVisibility}
                                  currentTeamMemberRole={team.currentTeamRole}
                                  {...field}
                                  onValueChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                    </>
                  ))
                  .otherwise(() => null)}
              </fieldset>

              <div className="flex flex-row justify-end gap-4 p-6">
                <DialogClose asChild>
                  <Button variant="secondary" disabled={form.formState.isSubmitting}>
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Update</Trans>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
