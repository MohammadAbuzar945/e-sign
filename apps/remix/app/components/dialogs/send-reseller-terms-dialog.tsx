import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSession } from '@documenso/lib/client-only/providers/session';
import {
  createDefaultResellerTermsSignatories,
  createDefaultResellerTermsVariableValues,
  formatResellerTermsVariableLabel,
  type ResellerTermsVariableValues,
} from '@documenso/lib/constants/reseller-terms-variables';
import type { NomiaDocGenTemplateVariable } from '@documenso/lib/server-only/nomia-docgen/fetch-template-variables';
import { RESELLER_TERMS_PROVIDER } from '@documenso/lib/server-only/site-settings/schemas/reseller';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@documenso/ui/primitives/use-toast';

type ResellerApplicationRow = {
  id: string;
  snapshotOrgName: string;
  snapshotApplicantName: string;
  snapshotApplicantEmail: string;
  termsVariableValues?: unknown;
};

type SendResellerTermsDialogProps = {
  application: ResellerApplicationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

const ZResellerTermsFormSchema = z.object({
  variableValues: z.record(z.string(), z.string()),
  signatories: z
    .array(
      z.object({
        signatoryIndex: z.number().int().positive(),
        fullName: z.string().min(1, { message: msg`Enter the signatory full name`.id }),
        email: z.string().email({ message: msg`Enter a valid email address`.id }),
        role: z.literal('SIGNER'),
      }),
    )
    .min(1, { message: msg`Add at least one signatory`.id }),
  showInNomia: z.boolean(),
  buildForEsign: z.boolean(),
  sendForEsign: z.boolean(),
  esignApiKey: z.string().optional(),
});

type TResellerTermsFormSchema = z.infer<typeof ZResellerTermsFormSchema>;

const createDefaultFormValues = ({
  organisationName,
  applicantName,
  applicantEmail,
  senderName,
  senderEmail,
  templateVariables,
  storedVariableValues,
}: {
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
  senderName?: string | null;
  senderEmail?: string | null;
  templateVariables: NomiaDocGenTemplateVariable[];
  storedVariableValues?: ResellerTermsVariableValues | null;
}): TResellerTermsFormSchema => ({
  variableValues: createDefaultResellerTermsVariableValues({
    organisationName,
    applicantName,
    applicantEmail,
    templateVariables,
    storedVariableValues,
  }),
  signatories: createDefaultResellerTermsSignatories({
    applicantName,
    applicantEmail,
    senderName,
    senderEmail,
    templateVariables,
  }),
  showInNomia: true,
  buildForEsign: true,
  sendForEsign: true,
  esignApiKey: '',
});

export const SendResellerTermsDialog = ({
  application,
  open,
  onOpenChange,
  onSuccess,
}: SendResellerTermsDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const senderName = user.name ?? user.email;
  const senderEmail = user.email;

  const {
    data: templateVariablesData,
    isLoading: isLoadingTemplateVariables,
    error: templateVariablesError,
  } = trpc.admin.resellerApplications.getTermsTemplateVariables.useQuery(undefined, {
    enabled: open,
    retry: false,
  });

  const {
    data: applicationDetails,
    isLoading: isLoadingApplicationDetails,
    error: applicationDetailsError,
  } = trpc.admin.resellerApplications.get.useQuery(
    {
      applicationId: application?.id ?? '',
    },
    {
      enabled: open && !!application?.id,
      retry: false,
    },
  );

  const editableVariables = templateVariablesData?.editableVariables ?? [];
  const allTemplateVariables = templateVariablesData?.variables ?? [];
  const usesNomiaDocGen =
    (templateVariablesData?.provider ?? RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN) ===
    RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN;

  const organisationName =
    applicationDetails?.snapshotOrgName ?? application?.snapshotOrgName ?? '';
  const applicantName =
    applicationDetails?.snapshotApplicantName ?? application?.snapshotApplicantName ?? '';
  const applicantEmail =
    applicationDetails?.snapshotApplicantEmail ?? application?.snapshotApplicantEmail ?? '';
  const storedVariableValues = applicationDetails?.termsVariableValues ?? null;

  const isLoadingPrefillData = isLoadingTemplateVariables || isLoadingApplicationDetails;

  const defaultValues = useMemo(
    () =>
      createDefaultFormValues({
        organisationName,
        applicantName,
        applicantEmail,
        senderName,
        senderEmail,
        templateVariables: allTemplateVariables,
        storedVariableValues,
      }),
    [
      allTemplateVariables,
      applicantEmail,
      applicantName,
      organisationName,
      senderEmail,
      senderName,
      storedVariableValues,
    ],
  );

  const form = useForm<TResellerTermsFormSchema>({
    resolver: zodResolver(ZResellerTermsFormSchema),
    defaultValues,
  });

  const { fields: signatoryFields } = useFieldArray({
    control: form.control,
    name: 'signatories',
  });

  useEffect(() => {
    if (!open || !application || isLoadingPrefillData) {
      return;
    }

    if (usesNomiaDocGen && allTemplateVariables.length === 0) {
      return;
    }

    form.reset(
      createDefaultFormValues({
        organisationName,
        applicantName,
        applicantEmail,
        senderName,
        senderEmail,
        templateVariables: allTemplateVariables,
        storedVariableValues,
      }),
    );
  }, [
    allTemplateVariables,
    applicantEmail,
    applicantName,
    application,
    form,
    isLoadingPrefillData,
    open,
    organisationName,
    senderEmail,
    senderName,
    storedVariableValues,
    usesNomiaDocGen,
  ]);

  const { mutateAsync: sendTerms, isPending } = trpc.admin.resellerApplications.sendTerms.useMutation(
    {
      onSuccess: async () => {
        toast({
          title: _(msg`Terms sent`),
          description: usesNomiaDocGen
            ? _(msg`Reseller T&Cs have been sent via Nomia DocGen.`)
            : _(msg`Reseller T&Cs have been sent via the internal e-sign template.`),
        });

        onOpenChange(false);
        await onSuccess();
      },
      onError: (error) => {
        const parsed = AppError.parseError(error);

        toast({
          title: _(msg`Failed to send T&Cs`),
          description: parsed.message,
          variant: 'destructive',
        });
      },
    },
  );

  const onSubmit = async (values: TResellerTermsFormSchema) => {
    if (!application) {
      return;
    }

    const { variableValues, signatories, showInNomia, buildForEsign, sendForEsign, esignApiKey } =
      values;

    await sendTerms({
      applications: [
        {
          applicationId: application.id,
          variableValues,
          signatories,
          docGenOptions: {
            showInNomia,
            buildForEsign,
            sendForEsign,
            esignApiKey: esignApiKey?.trim() || undefined,
          },
        },
      ],
    });
  };

  const templateVariablesErrorMessage = templateVariablesError
    ? AppError.parseError(templateVariablesError).message
    : null;

  const applicationDetailsErrorMessage = applicationDetailsError
    ? AppError.parseError(applicationDetailsError).message
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>Send reseller T&Cs</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Values below are prefilled from what the reseller entered when applying. You can
              override any field before sending T&Cs for {organisationName || 'this organisation'}.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {isLoadingPrefillData ? (
          <p className="text-muted-foreground text-sm">
            <Trans>Loading applicant values and template variables...</Trans>
          </p>
        ) : null}

        {templateVariablesErrorMessage ? (
          <p className="text-destructive text-sm">{templateVariablesErrorMessage}</p>
        ) : null}

        {applicationDetailsErrorMessage ? (
          <p className="text-destructive text-sm">{applicationDetailsErrorMessage}</p>
        ) : null}

        {!usesNomiaDocGen && !isLoadingPrefillData ? (
          <p className="text-muted-foreground rounded-md border p-3 text-sm">
            <Trans>
              Site settings are using the internal e-sign template. DocGen variables and options
              are not required.
            </Trans>
          </p>
        ) : null}

        {!isLoadingPrefillData && usesNomiaDocGen && !storedVariableValues ? (
          <p className="text-muted-foreground rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <Trans>
              No applicant-submitted variable values were found for this application. Showing
              template defaults instead.
            </Trans>
          </p>
        ) : null}

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="space-y-4"
              disabled={isPending || isLoadingPrefillData || !!templateVariablesErrorMessage}
            >
              {usesNomiaDocGen ? (
                <>
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">
                  <Trans>Nomia DocGen options</Trans>
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="showInNomia"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel>
                            <Trans>Show in Nomia</Trans>
                          </FormLabel>
                          <FormDescription>
                            <Trans>Store the generated document in Nomia.</Trans>
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buildForEsign"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel>
                            <Trans>Build for e-sign</Trans>
                          </FormLabel>
                          <FormDescription>
                            <Trans>Prepare the document for e-signing.</Trans>
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sendForEsign"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);

                              if (checked) {
                                form.setValue('buildForEsign', true);
                              }
                            }}
                          />
                        </FormControl>
                        <div>
                          <FormLabel>
                            <Trans>Send for e-sign</Trans>
                          </FormLabel>
                          <FormDescription>
                            <Trans>Email the agreement to the applicant for signing.</Trans>
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="esignApiKey"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>
                        <Trans>E-sign API key</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="off"
                          placeholder="Optional"
                        />
                      </FormControl>
                      <FormDescription>
                        <Trans>
                          Optional. Required only when build or send for e-sign is enabled. Uses
                          the default from Admin Site Settings if left blank.
                        </Trans>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <div>
                  <p className="text-sm font-medium">
                    <Trans>Signatories</Trans>
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    <Trans>
                      Detected from the DocGen template. Signatory 1 defaults to you (the sender);
                      other signatories use the reseller applicant.
                    </Trans>
                  </p>
                </div>

                <div className="space-y-4">
                  {signatoryFields.map((signatoryField, index) => (
                    <div
                      key={signatoryField.id}
                      className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2"
                    >
                      <div className="sm:col-span-2">
                        <p className="text-sm font-medium">
                          <Trans>Signatory {form.watch(`signatories.${index}.signatoryIndex`)}</Trans>
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {form.watch(`signatories.${index}.signatoryIndex`) === 1 ? (
                              <Trans>Company</Trans>
                            ) : (
                              <Trans>Reseller / Party</Trans>
                            )}
                          </span>
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name={`signatories.${index}.fullName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Full name</Trans>
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
                        name={`signatories.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Email</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <input
                        type="hidden"
                        {...form.register(`signatories.${index}.signatoryIndex`, {
                          valueAsNumber: true,
                        })}
                      />
                      <input
                        type="hidden"
                        {...form.register(`signatories.${index}.role`)}
                        value="SIGNER"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {editableVariables.map((variable) => (
                  <FormField
                    key={variable.variable_name}
                    control={form.control}
                    name={`variableValues.${variable.variable_name}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {formatResellerTermsVariableLabel(variable.variable_name)}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
                </>
              ) : null}
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={
                  isLoadingPrefillData ||
                  !!templateVariablesErrorMessage ||
                  (usesNomiaDocGen && editableVariables.length === 0)
                }
              >
                <Trans>Send T&Cs</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
