import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation.types';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const ZCreateOrganisationFormSchema = ZCreateOrganisationRequestSchema.pick({
  name: true,
});

export type TCreateOrganisationFormSchema = z.infer<typeof ZCreateOrganisationFormSchema>;

export const OrganisationCreateDialog = ({ trigger, ...props }: OrganisationCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const actionSearchParam = searchParams?.get('action');

  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutateAsync: createOrganisation } = trpc.organisation.create.useMutation();

  const onFormSubmit = async ({ name }: TCreateOrganisationFormSchema) => {
    try {
      await createOrganisation({
        name,
      });

      await refreshSession();
      setOpenValue(false);

      toast({
        title: t`Success`,
        description: t`Your organisation has been created.`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      const isDuplicateName = error.code === 'ALREADY_EXISTS';
      toast({
        title: isDuplicateName ? t`Organisation already exists` : t`An unknown error occurred`,
        description:
          error.message ||
          (isDuplicateName
            ? t`You already have an organisation with this name. Please choose a different name.`
            : t`We encountered an unknown error while attempting to create a organisation. Please try again later.`),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (actionSearchParam === 'add-organisation') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open, updateSearchParams]);

  useEffect(() => {
    form.reset();
  }, [open, form]);

  // If open prop is provided, the dialog is controlled and we shouldn't render the trigger
  const isControlled = props.open !== undefined;
  const openValue = isControlled ? props.open : open;
  const setOpenValue = (value: boolean) => {
    if (!form.formState.isSubmitting) {
      setOpen(value);
      props.onOpenChange?.(value);
    }
  };

  const handleClose = () => setOpenValue(false);

  return (
    <Dialog
      {...props}
      open={openValue}
      onOpenChange={setOpenValue}
    >
      {!isControlled && (
        <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
          {trigger ?? (
            <Button className="flex-shrink-0" variant="secondary">
              <Trans>Create organisation</Trans>
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create organisation</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create an organisation to collaborate with teams</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Organisation Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={handleClose}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-button"
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Create</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

