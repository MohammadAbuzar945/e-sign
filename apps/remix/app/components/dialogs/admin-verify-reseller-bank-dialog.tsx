import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

const ZVerifyBankFormSchema = z.object({
  accountType: z.enum(['personal', 'business']),
  documentType: z.enum(['identityNumber', 'passportNumber', 'businessRegistrationNumber']),
  documentNumber: z.string().min(5).max(64),
});

type AdminVerifyResellerBankDialogProps = {
  applicationId: string | null;
  organisationName: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
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
  open,
  onOpenChange,
  onSuccess,
}: AdminVerifyResellerBankDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof ZVerifyBankFormSchema>>({
    resolver: zodResolver(ZVerifyBankFormSchema),
    defaultValues: {
      accountType: 'personal',
      documentType: 'identityNumber',
      documentNumber: '',
    },
  });

  const { mutateAsync: verifyBankAccount, isPending } =
    trpc.admin.resellerApplications.verifyBankAccount.useMutation();

  useEffect(() => {
    if (!open) {
      form.reset({
        accountType: 'personal',
        documentType: 'identityNumber',
        documentNumber: '',
      });
    }
  }, [open, form]);

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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">
                          <Trans>Personal</Trans>
                        </SelectItem>
                        <SelectItem value="business">
                          <Trans>Business</Trans>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="identityNumber">
                          <Trans>Identity number</Trans>
                        </SelectItem>
                        <SelectItem value="passportNumber">
                          <Trans>Passport number</Trans>
                        </SelectItem>
                        <SelectItem value="businessRegistrationNumber">
                          <Trans>Business registration number</Trans>
                        </SelectItem>
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
                      <Input {...field} placeholder={_(msg`Enter ID / passport / reg number`)} />
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
