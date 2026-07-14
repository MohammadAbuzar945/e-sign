import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  getDefaultResellerBankDocumentType,
  getResellerBankAccountTypeLabel,
  getResellerBankDocumentTypeLabel,
  getResellerBankDocumentTypesForAccountType,
  ZResellerBankAccountTypeSchema,
  ZResellerBankDocumentTypeSchema,
  ZResellerBankVerificationFieldsSchema,
  type ResellerBankAccountType,
} from '@documenso/lib/constants/reseller-bank-verification';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZVerifyBankFormSchema = z
  .object({
    accountType: ZResellerBankAccountTypeSchema,
    documentType: ZResellerBankDocumentTypeSchema,
    documentNumber: z.string().trim().min(5).max(64),
  })
  .superRefine((values, context) => {
    const verificationResult = ZResellerBankVerificationFieldsSchema.safeParse(values);

    if (!verificationResult.success) {
      for (const issue of verificationResult.error.issues) {
        context.addIssue(issue);
      }
    }
  });

type AdminVerifyResellerBankDialogProps = {
  applicationId: string | null;
  organisationName: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountType?: ResellerBankAccountType | null;
  bankDocumentType?: z.infer<typeof ZResellerBankDocumentTypeSchema> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
};

export const AdminVerifyResellerBankDialog = ({
  applicationId,
  organisationName,
  bankName,
  bankAccountName,
  bankAccountNumber,
  bankAccountType,
  bankDocumentType,
  open,
  onOpenChange,
  onSuccess,
}: AdminVerifyResellerBankDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const defaultAccountType = bankAccountType ?? 'personal';

  const form = useForm<z.infer<typeof ZVerifyBankFormSchema>>({
    resolver: zodResolver(ZVerifyBankFormSchema),
    defaultValues: {
      accountType: defaultAccountType,
      documentType: bankDocumentType ?? getDefaultResellerBankDocumentType(defaultAccountType),
      documentNumber: '',
    },
  });

  const selectedAccountType = form.watch('accountType');
  const documentTypeOptions = getResellerBankDocumentTypesForAccountType(selectedAccountType);

  const { mutateAsync: verifyBankAccount, isPending } =
    trpc.admin.resellerApplications.verifyBankAccount.useMutation();

  useEffect(() => {
    if (!open) {
      form.reset({
        accountType: defaultAccountType,
        documentType: bankDocumentType ?? getDefaultResellerBankDocumentType(defaultAccountType),
        documentNumber: '',
      });
    }
  }, [open, form, defaultAccountType, bankDocumentType]);

  useEffect(() => {
    const currentDocumentType = form.getValues('documentType');

    if (!documentTypeOptions.includes(currentDocumentType)) {
      form.setValue('documentType', getDefaultResellerBankDocumentType(selectedAccountType), {
        shouldValidate: true,
      });
    }
  }, [form, documentTypeOptions, selectedAccountType]);

  const handleSubmit = async (values: z.infer<typeof ZVerifyBankFormSchema>) => {
    if (!applicationId) {
      return;
    }

    try {
      const result = await verifyBankAccount({
        applicationId,
        accountType: values.accountType,
        documentType: values.documentType,
        documentNumber: values.documentNumber.trim(),
        countryCode: 'ZA',
      });

      toast({
        title: _(msg`Bank account verified`),
        description: result.verificationMessage,
      });

      onOpenChange(false);
      await onSuccess();
    } catch (error) {
      toast({
        title: _(msg`Verification failed`),
        description: AppError.parseError(error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Verify bank account</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Validate {organisationName ?? 'this reseller'}'s bank details with Paystack using
              their ID or registration document. On success, Nomia activates the payout subaccount.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p>
            <Trans>Bank: {bankName ?? '—'}</Trans>
          </p>
          <p>
            <Trans>Account name: {bankAccountName ?? '—'}</Trans>
          </p>
          <p>
            <Trans>Account number: {bankAccountNumber ?? '—'}</Trans>
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <fieldset disabled={isPending} className="space-y-4">
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Account type</Trans>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue(
                          'documentType',
                          getDefaultResellerBankDocumentType(value as ResellerBankAccountType),
                          { shouldValidate: true },
                        );
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">
                          {getResellerBankAccountTypeLabel('personal')}
                        </SelectItem>
                        <SelectItem value="business">
                          {getResellerBankAccountTypeLabel('business')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Document type</Trans>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {documentTypeOptions.map((documentType) => (
                          <SelectItem key={documentType} value={documentType}>
                            {getResellerBankDocumentTypeLabel(documentType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Document number</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={_(msg`Enter ID / CNIC / passport / registration number`)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>
              <Button type="submit" loading={isPending}>
                <Trans>Verify with Paystack</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
