import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createDefaultResellerTermsVariableValues,
  RESELLER_TERMS_TEMPLATE_VARIABLES,
  RESELLER_TERMS_VARIABLE_LABELS,
} from '@documenso/lib/constants/reseller-terms-variables';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZResellerTermsVariableValuesSchema } from '@documenso/trpc/server/admin-router/reseller-applications.types';
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
};

type SendResellerTermsDialogProps = {
  application: ResellerApplicationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

const ZResellerTermsFormSchema = ZResellerTermsVariableValuesSchema.extend({
  showInNomia: z.boolean(),
  buildForEsign: z.boolean(),
  sendForEsign: z.boolean(),
  esignApiKey: z.string().optional(),
});

type TResellerTermsFormSchema = z.infer<typeof ZResellerTermsFormSchema>;

const createDefaultFormValues = (application: ResellerApplicationRow | null) => ({
  ...createDefaultResellerTermsVariableValues({
    organisationName: application?.snapshotOrgName ?? '',
    applicantName: application?.snapshotApplicantName ?? '',
    applicantEmail: application?.snapshotApplicantEmail ?? '',
  }),
  showInNomia: true,
  buildForEsign: false,
  sendForEsign: false,
  esignApiKey: '',
});

const getVariableLabel = (variableName: (typeof RESELLER_TERMS_TEMPLATE_VARIABLES)[number]) =>
  RESELLER_TERMS_VARIABLE_LABELS[variableName];

export const SendResellerTermsDialog = ({
  application,
  open,
  onOpenChange,
  onSuccess,
}: SendResellerTermsDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const defaultValues = useMemo(() => createDefaultFormValues(application), [application]);

  const form = useForm<TResellerTermsFormSchema>({
    resolver: zodResolver(ZResellerTermsFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open && application) {
      form.reset(createDefaultFormValues(application));
    }
  }, [application, form, open]);

  const { mutateAsync: sendTerms, isPending } = trpc.admin.resellerApplications.sendTerms.useMutation({
    onSuccess: async () => {
      toast({
        title: _(msg`Terms sent`),
        description: _(msg`Reseller T&Cs have been sent via Nomia DocGen.`),
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
  });

  const onSubmit = async (values: TResellerTermsFormSchema) => {
    if (!application) {
      return;
    }

    const { showInNomia, buildForEsign, sendForEsign, esignApiKey, ...variableValues } = values;

    await sendTerms({
      applications: [
        {
          applicationId: application.id,
          variableValues,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <Trans>Send reseller T&Cs</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Choose how Nomia should generate the document for {application?.snapshotOrgName} and
              fill in the template variables.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="space-y-4" disabled={isPending}>
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

              <div className="grid gap-4 sm:grid-cols-2">
              {RESELLER_TERMS_TEMPLATE_VARIABLES.map((variableName) => (
                <FormField
                  key={variableName}
                  control={form.control}
                  name={variableName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getVariableLabel(variableName)}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>
              <Button type="submit" loading={isPending}>
                <Trans>Send T&Cs</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
