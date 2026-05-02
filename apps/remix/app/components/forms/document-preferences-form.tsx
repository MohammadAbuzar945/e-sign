import { zodResolver } from '@hookform/resolvers/zod';
import { msg, t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { DocumentVisibility, OrganisationType, type RecipientRole } from '@prisma/client';
import type { ChangeEvent } from 'react';
import { InfoIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { DATE_FORMATS } from '@documenso/lib/constants/date-formats';
import { DOCUMENT_SIGNATURE_TYPES, DocumentSignatureType } from '@documenso/lib/constants/document';
import {
  type TEnvelopeExpirationPeriod,
  ZEnvelopeExpirationPeriod,
} from '@documenso/lib/constants/envelope-expiration';
import {
  type TEnvelopeReminderSettings,
  ZEnvelopeReminderSettings,
} from '@documenso/lib/constants/envelope-reminder';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '@documenso/lib/constants/i18n';
import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import type { TDefaultRecipients } from '@documenso/lib/types/default-recipients';
import { ZDefaultRecipientsSchema } from '@documenso/lib/types/default-recipients';
import {
  ZDocumentKbaModeSchema,
  type TDocumentKbaSettings,
} from '@documenso/lib/types/document-auth';
import {
  type TDocumentMetaDateFormat,
  ZDocumentMetaTimezoneSchema,
} from '@documenso/lib/types/document-meta';
import { normalizeStoredKbaSettings } from '@documenso/lib/utils/kba-settings';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { extractTeamSignatureSettings } from '@documenso/lib/utils/teams';
import { DocumentSignatureSettingsTooltip } from '@documenso/ui/components/document/document-signature-settings-tooltip';
import { ExpirationPeriodPicker } from '@documenso/ui/components/document/expiration-period-picker';
import { ReminderSettingsPicker } from '@documenso/ui/components/document/reminder-settings-picker';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Switch } from '@documenso/ui/primitives/switch';
import { Combobox } from '@documenso/ui/primitives/combobox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Input } from '@documenso/ui/primitives/input';

import { useOptionalCurrentTeam } from '~/providers/team';

import { DefaultRecipientsMultiSelectCombobox } from '../general/default-recipients-multiselect-combobox';

/**
 * Can't infer this from the schema since we need to keep the schema inside the component to allow
 * it to be dynamic.
 */
export type TDocumentPreferencesFormSchema = {
  documentVisibility: DocumentVisibility | null;
  documentLanguage: (typeof SUPPORTED_LANGUAGE_CODES)[number] | null;
  documentTimezone: string | null;
  documentDateFormat: TDocumentMetaDateFormat | null;
  includeSenderDetails: boolean | null;
  includeSigningCertificate: boolean | null;
  includeQrCodeInCertificate: boolean | null;
  includeAuditLog: boolean | null;
  signatureTypes: DocumentSignatureType[];
  defaultRecipients: TDefaultRecipients | null;
  delegateDocumentOwnership: boolean | null;
  aiFeaturesEnabled: boolean | null;
  envelopeExpirationPeriod: TEnvelopeExpirationPeriod | null;
  reminderSettings: TEnvelopeReminderSettings | null;
  kbaInheritOrganisationKbaDefaults: boolean;
  kbaMode: TDocumentKbaSettings['mode'];
  kbaIsEnabled: boolean;
  kbaMaxAttempts: number;
  kbaLockoutMinutes: number;
};

type SettingsSubset = Pick<
  TeamGlobalSettings,
  | 'documentVisibility'
  | 'documentLanguage'
  | 'documentTimezone'
  | 'documentDateFormat'
  | 'includeSenderDetails'
  | 'includeSigningCertificate'
  | 'includeQrCodeInCertificate'
  | 'includeAuditLog'
  | 'typedSignatureEnabled'
  | 'uploadSignatureEnabled'
  | 'drawSignatureEnabled'
  | 'defaultRecipients'
  | 'delegateDocumentOwnership'
  | 'aiFeaturesEnabled'
  | 'envelopeExpirationPeriod'
  | 'reminderSettings'
> & {
  /** Organisation/team stored JSON; null on team means inherit organisation defaults. */
  kbaSettings?: unknown | null;
};

export type DocumentPreferencesFormProps = {
  settings: SettingsSubset;
  canInherit: boolean;
  /**
   * Effective KBA defaults when the team has not overridden (`kbaSettings` is null on the team).
   */
  effectiveKbaSettings?: TDocumentKbaSettings;
  isAiFeaturesConfigured?: boolean;
  onFormSubmit: (data: TDocumentPreferencesFormSchema) => Promise<void>;
};

export const DocumentPreferencesForm = ({
  settings,
  onFormSubmit,
  canInherit,
  effectiveKbaSettings,
  isAiFeaturesConfigured = false,
}: DocumentPreferencesFormProps) => {
  const { _ } = useLingui();
  const { user, organisations } = useSession();
  const currentOrganisation = useCurrentOrganisation();
  const optionalTeam = useOptionalCurrentTeam();

  const isPersonalLayoutMode = isPersonalLayout(organisations);
  const isPersonalOrganisation = currentOrganisation.type === OrganisationType.PERSONAL;

  const placeholderEmail = user.email ?? 'user@example.com';

  const ZDocumentPreferencesFormSchema = z.object({
    documentVisibility: z.nativeEnum(DocumentVisibility).nullable(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).nullable(),
    documentTimezone: z.string().nullable(),
    documentDateFormat: ZDocumentMetaTimezoneSchema.nullable(),
    includeSenderDetails: z.boolean().nullable(),
    includeSigningCertificate: z.boolean().nullable(),
    includeQrCodeInCertificate: z.boolean().nullable(),
    includeAuditLog: z.boolean().nullable(),
    signatureTypes: z.array(z.nativeEnum(DocumentSignatureType)).min(canInherit ? 0 : 1, {
      message: msg`At least one signature type must be enabled`.id,
    }),
    defaultRecipients: ZDefaultRecipientsSchema.nullable(),
    delegateDocumentOwnership: z.boolean().nullable(),
    aiFeaturesEnabled: z.boolean().nullable(),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.nullable(),
    reminderSettings: ZEnvelopeReminderSettings.nullable(),
    kbaInheritOrganisationKbaDefaults: z.boolean(),
    kbaMode: ZDocumentKbaModeSchema,
    kbaIsEnabled: z.boolean(),
    kbaMaxAttempts: z.number().int().min(1).max(20),
    kbaLockoutMinutes: z.number().int().min(1).max(1440),
  });

  const resolvedEffectiveKba =
    effectiveKbaSettings ?? normalizeStoredKbaSettings(settings.kbaSettings);
  const displayKba = normalizeStoredKbaSettings(
    canInherit && settings.kbaSettings === null ? resolvedEffectiveKba : settings.kbaSettings,
  );

  const form = useForm<TDocumentPreferencesFormSchema>({
    defaultValues: {
      documentVisibility: settings.documentVisibility,
      documentLanguage: isValidLanguageCode(settings.documentLanguage)
        ? settings.documentLanguage
        : null,
      documentTimezone: settings.documentTimezone,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      documentDateFormat: settings.documentDateFormat as TDocumentMetaDateFormat | null,
      includeSenderDetails: settings.includeSenderDetails,
      includeSigningCertificate: settings.includeSigningCertificate,
      includeQrCodeInCertificate: settings.includeQrCodeInCertificate,
      includeAuditLog: settings.includeAuditLog,
      signatureTypes: extractTeamSignatureSettings({ ...settings }),
      defaultRecipients: settings.defaultRecipients
        ? ZDefaultRecipientsSchema.parse(settings.defaultRecipients)
        : null,
      delegateDocumentOwnership: settings.delegateDocumentOwnership,
      aiFeaturesEnabled: settings.aiFeaturesEnabled,
      envelopeExpirationPeriod: settings.envelopeExpirationPeriod ?? null,
      reminderSettings: settings.reminderSettings ?? null,
      kbaInheritOrganisationKbaDefaults: canInherit ? settings.kbaSettings === null : false,
      kbaMode: displayKba.mode,
      kbaIsEnabled: displayKba.isEnabled,
      kbaMaxAttempts: displayKba.maxAttempts,
      kbaLockoutMinutes: displayKba.lockoutMinutes,
    },
    resolver: zodResolver(ZDocumentPreferencesFormSchema),
  });

  const kbaInheritOrganisationKbaDefaults = form.watch('kbaInheritOrganisationKbaDefaults');
  const kbaIsEnabled = form.watch('kbaIsEnabled');
  const showTeamKbaOverrideFields = canInherit && !kbaInheritOrganisationKbaDefaults;
  const showKbaTuningFields =
    kbaIsEnabled && (!canInherit || showTeamKbaOverrideFields);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset
          className="flex h-full max-w-2xl flex-col gap-y-6"
          disabled={form.formState.isSubmitting}
        >
          {!isPersonalLayoutMode && (
            <FormField
              control={form.control}
              name="documentVisibility"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Default Document Visibility</Trans>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      value={field.value === null ? '-1' : field.value}
                      onValueChange={(value) => field.onChange(value === '-1' ? null : value)}
                    >
                      <SelectTrigger
                        className="bg-background text-muted-foreground"
                        data-testid="document-visibility-trigger"
                      >
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={DocumentVisibility.EVERYONE}>
                          <Trans>Everyone can access and view the document</Trans>
                        </SelectItem>
                        <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE}>
                          <Trans>Only managers and above can access and view the document</Trans>
                        </SelectItem>
                        <SelectItem value={DocumentVisibility.ADMIN}>
                          <Trans>Only admins can access and view the document</Trans>
                        </SelectItem>

                        {canInherit && (
                          <SelectItem value={'-1'}>
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormDescription>
                    <Trans>Controls the default visibility of an uploaded document.</Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="documentLanguage"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Document Language</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value}
                    onValueChange={(value) => field.onChange(value === '-1' ? null : value)}
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="document-language-trigger"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {Object.entries(SUPPORTED_LANGUAGES).map(([code, language]) => (
                        <SelectItem key={code} value={code}>
                          {_(language.full)}
                        </SelectItem>
                      ))}

                      <SelectItem value={'-1'}>
                        <Trans>Inherit from organisation</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls the default language of an uploaded document. This will be used as the
                    language in email communications with the recipients.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentDateFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Default Date Format</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    value={field.value === null ? '-1' : field.value}
                    onValueChange={(value) => field.onChange(value === '-1' ? null : value)}
                  >
                    <SelectTrigger data-testid="document-date-format-trigger">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {DATE_FORMATS.map((format) => (
                        <SelectItem key={format.key} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentTimezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Default Time Zone</Trans>
                </FormLabel>

                <FormControl>
                  <Combobox
                    triggerPlaceholder={
                      canInherit ? t`Inherit from organisation` : t`Local timezone`
                    }
                    placeholder={t`Select a time zone`}
                    options={TIME_ZONES}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    testId="document-timezone-trigger"
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="signatureTypes"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="flex flex-row items-center">
                  <Trans>Default Signature Settings</Trans>
                  <DocumentSignatureSettingsTooltip />
                </FormLabel>

                <FormControl>
                  <MultiSelectCombobox
                    options={Object.values(DOCUMENT_SIGNATURE_TYPES).map((option) => ({
                      label: _(option.label),
                      value: option.value,
                    }))}
                    selectedValues={field.value}
                    onChange={field.onChange}
                    className="w-full bg-background"
                    enableSearch={false}
                    emptySelectionPlaceholder={
                      canInherit ? t`Inherit from organisation` : t`Select signature types`
                    }
                    testId="signature-types-trigger"
                  />
                </FormControl>

                {form.formState.errors.signatureTypes ? (
                  <FormMessage />
                ) : (
                  <FormDescription>
                    <Trans>
                      Controls which signatures are allowed to be used when signing a document.
                    </Trans>
                  </FormDescription>
                )}
              </FormItem>
            )}
          />

          {!isPersonalLayoutMode && !isPersonalOrganisation && (
            <FormField
              control={form.control}
              name="includeSenderDetails"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Send on Behalf of Team</Trans>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      value={field.value === null ? '-1' : field.value.toString()}
                      onValueChange={(value) =>
                        field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                      }
                    >
                      <SelectTrigger
                        className="bg-background text-muted-foreground"
                        data-testid="include-sender-details-trigger"
                      >
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="true">
                          <Trans>Yes</Trans>
                        </SelectItem>

                        <SelectItem value="false">
                          <Trans>No</Trans>
                        </SelectItem>

                        {canInherit && (
                          <SelectItem value={'-1'}>
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <div className="pt-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      <Trans>Preview</Trans>
                    </div>

                    <Alert variant="neutral" className="mt-1 px-2.5 py-1.5 text-sm">
                      {field.value ? (
                        <Trans>
                          "{placeholderEmail}" on behalf of "Team Name" has invited you to sign
                          "example document".
                        </Trans>
                      ) : (
                        <Trans>"Team Name" has invited you to sign "example document".</Trans>
                      )}
                    </Alert>
                  </div>

                  <FormDescription>
                    <Trans>
                      Controls the formatting of the message that will be sent when inviting a
                      recipient to sign a document. If a custom message has been provided while
                      configuring the document, it will be used instead.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="includeSigningCertificate"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Include the Signing Certificate in the Document</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="include-signing-certificate-trigger"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls whether the signing certificate will be included in the document when
                    it is downloaded. The signing certificate can still be downloaded from the logs
                    page separately.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="includeQrCodeInCertificate"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Include QR code in certificate</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger className="bg-background text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    When enabled, the signing certificate PDF will include a QR code linking to the
                    document. Default is on. Can be overridden per document in Security settings.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="includeAuditLog"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Include the Audit Logs in the Document</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger className="bg-background text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls whether the audit logs will be included in the document when it is
                    downloaded. The audit logs can still be downloaded from the logs page
                    separately.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultRecipients"
            render={({ field }) => {
              const recipients = field.value ?? [];

              return (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Default Recipients</Trans>
                  </FormLabel>

                  {canInherit && (
                    <Select
                      value={field.value === null ? '-1' : '0'}
                      onValueChange={(value) => field.onChange(value === '-1' ? null : [])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                        <SelectItem value={'0'}>
                          <Trans>Override organisation settings</Trans>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {(field.value !== null || !canInherit) && (
                    <div className="space-y-4">
                      <DefaultRecipientsMultiSelectCombobox
                        listValues={recipients}
                        onChange={field.onChange}
                        organisationId={!canInherit ? currentOrganisation.id : undefined}
                        teamId={canInherit ? optionalTeam?.id : undefined}
                      />

                      {recipients.map((recipient, index) => {
                        return (
                          <div
                            key={recipient.email}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3"
                          >
                            <AvatarWithText
                              avatarFallback={recipientAbbreviation(recipient)}
                              primaryText={
                                <span className="text-sm font-medium">
                                  {recipient.name || recipient.email}
                                </span>
                              }
                              secondaryText={
                                recipient.name ? (
                                  <span className="text-xs text-muted-foreground">
                                    {recipient.email}
                                  </span>
                                ) : undefined
                              }
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <RecipientRoleSelect
                                value={recipient.role}
                                onValueChange={(role: RecipientRole) => {
                                  field.onChange(
                                    recipients.map((recipient, idx) =>
                                      idx === index ? { ...recipient, role } : recipient,
                                    ),
                                  );
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <FormDescription>
                    <Trans>Recipients that will be automatically added to new documents.</Trans>
                  </FormDescription>
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="delegateDocumentOwnership"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Delegate Document Ownership</Trans>
                </FormLabel>

                <Select
                  {...field}
                  value={field.value === null ? '-1' : field.value.toString()}
                  onValueChange={(value) =>
                    field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                  }
                >
                  <SelectTrigger className="bg-background text-muted-foreground">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="true">
                      <Trans>Yes</Trans>
                    </SelectItem>

                    <SelectItem value="false">
                      <Trans>No</Trans>
                    </SelectItem>

                    {canInherit && (
                      <SelectItem value={'-1'}>
                        <Trans>Inherit from organisation</Trans>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <FormDescription>
                  <Trans>
                    Enable team API tokens to delegate document ownership to another team member.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="envelopeExpirationPeriod"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Envelope Expiration</Trans>
                </FormLabel>

                <FormControl>
                  <ExpirationPeriodPicker
                    value={field.value}
                    onChange={field.onChange}
                    inheritLabel={canInherit ? t`Inherit from organisation` : undefined}
                  />
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls how long recipients have to complete signing before the document
                    expires. After expiration, recipients can no longer sign the document.
                  </Trans>
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reminderSettings"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Default Signing Reminders</Trans>
                </FormLabel>

                <FormControl>
                  <ReminderSettingsPicker
                    value={field.value}
                    onChange={field.onChange}
                    inheritLabel={canInherit ? t`Inherit from organisation` : undefined}
                  />
                </FormControl>

                <FormDescription>
                  <Trans>
                    Controls when and how often reminder emails are sent to recipients who have not
                    yet completed signing.
                  </Trans>
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />

          {isAiFeaturesConfigured && (
            <FormField
              control={form.control}
              name="aiFeaturesEnabled"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>AI Features</Trans>
                  </FormLabel>

                  <FormControl>
                    <Select
                      {...field}
                      value={field.value === null ? '-1' : field.value.toString()}
                      onValueChange={(value) =>
                        field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                      }
                    >
                      <SelectTrigger className="bg-background text-muted-foreground">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="true">
                          <Trans>Enabled</Trans>
                        </SelectItem>

                        <SelectItem value="false">
                          <Trans>Disabled</Trans>
                        </SelectItem>

                        {canInherit && (
                          <SelectItem value={'-1'}>
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormDescription>
                    <Trans>
                      Enable AI-powered features such as automatic recipient detection. When
                      enabled, document content will be sent to AI providers. We only use providers
                      that do not retain data for training and prefer European regions where
                      available.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          )}

          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-medium">
              <Trans>Knowledge-based authentication (KBA)</Trans>
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {canInherit ? (
                <Trans>Optional question before access. Documents can override.</Trans>
              ) : (
                <Trans>Default for teams that inherit. Documents can override.</Trans>
              )}
            </p>

            {canInherit && (
              <FormField
                control={form.control}
                name="kbaInheritOrganisationKbaDefaults"
                render={({ field }) => (
                  <FormItem className="mb-6 flex-1">
                    <FormLabel>
                      <Trans>Team KBA defaults</Trans>
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? '-1' : '0'}
                        onValueChange={(value) => {
                          const inherit = value === '-1';
                          field.onChange(inherit);
                          if (inherit) {
                            const next = normalizeStoredKbaSettings(resolvedEffectiveKba);
                            form.setValue('kbaMode', next.mode);
                            form.setValue('kbaIsEnabled', next.isEnabled);
                            form.setValue('kbaMaxAttempts', next.maxAttempts);
                            form.setValue('kbaLockoutMinutes', next.lockoutMinutes);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background text-muted-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">
                            <Trans>Inherit from organisation</Trans>
                          </SelectItem>
                          <SelectItem value="0">
                            <Trans>Override organisation settings</Trans>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {canInherit && kbaInheritOrganisationKbaDefaults && (
              <Alert variant="neutral" className="mb-6 [&>svg]:text-muted-foreground">
                <InfoIcon className="h-5 w-5" aria-hidden />
                <div className="min-w-0 space-y-3">
                  <div>
                    <AlertTitle>
                      <Trans>Organisation KBA defaults</Trans>
                    </AlertTitle>
                    <AlertDescription className="mt-1 text-sm text-muted-foreground">
                      <Trans>
                        This team follows your organisation&apos;s document preferences. Values
                        below are read-only here; choose &quot;Override organisation settings&quot;
                        to set KBA only for this team.
                      </Trans>
                    </AlertDescription>
                  </div>

                  <div className="rounded-md border bg-background/60 p-3 text-sm">
                    {resolvedEffectiveKba.isEnabled ? (
                      <div className="space-y-3">
                        <p className="font-medium text-foreground">
                          <Trans>
                            KBA is on for new documents — signers may be asked a question before
                            they can open the file.
                          </Trans>
                        </p>
                        <dl className="space-y-2.5 border-t border-border/60 pt-3">
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                            <dt className="font-medium text-foreground">
                              <Trans>Challenge scope</Trans>
                            </dt>
                            <dd className="max-w-md text-muted-foreground sm:text-right">
                              {resolvedEffectiveKba.mode === 'PER_ENVELOPE' ? (
                                <Trans>One question shared by everyone on the document</Trans>
                              ) : (
                                <Trans>Each signer gets their own question</Trans>
                              )}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                            <dt className="font-medium text-foreground">
                              <Trans>Wrong answers before lockout</Trans>
                            </dt>
                            <dd className="tabular-nums text-muted-foreground sm:text-right">
                              {resolvedEffectiveKba.maxAttempts}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                            <dt className="font-medium text-foreground">
                              <Trans>Lockout length</Trans>
                            </dt>
                            <dd className="tabular-nums text-muted-foreground sm:text-right">
                              <Trans>{resolvedEffectiveKba.lockoutMinutes} minutes</Trans>
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">
                          <Trans>KBA off at organisation level</Trans>
                        </p>
                        <p className="text-muted-foreground">
                          <Trans>
                            New documents do not get KBA by default from the organisation. If this
                            team should use KBA anyway, switch to &quot;Override organisation
                            settings&quot; and turn it on for the team.
                          </Trans>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            {(!canInherit || showTeamKbaOverrideFields) && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="kbaIsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <FormLabel className="text-base">
                          <Trans>Enable KBA by default</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Default for new documents when on.</Trans>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          className="shrink-0"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {showKbaTuningFields && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <FormField
                      control={form.control}
                      name="kbaMode"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>
                            <Trans>Default KBA scope</Trans>
                          </FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="bg-background text-muted-foreground">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PER_ENVELOPE">
                                  <Trans>One challenge for the whole document</Trans>
                                </SelectItem>
                                <SelectItem value="PER_RECIPIENT">
                                  <Trans>Separate challenge per recipient</Trans>
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
                      name="kbaMaxAttempts"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>
                            <Trans>Max attempts</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={Number.isFinite(field.value) ? String(field.value) : ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
                        <FormItem className="flex-1">
                          <FormLabel>
                            <Trans>Lockout (minutes)</Trans>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={1440}
                              value={Number.isFinite(field.value) ? String(field.value) : ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
                )}
              </div>
            )}
          </div>

          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
