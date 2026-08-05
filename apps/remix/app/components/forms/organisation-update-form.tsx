import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZUpdateOrganisationRequestSchema } from '@documenso/trpc/server/organisation-router/update-organisation.types';
import { Button } from '@documenso/ui/primitives/button';
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
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZOrganisationUpdateFormSchema = ZUpdateOrganisationRequestSchema.shape.data.pick({
  name: true,
  url: true,
  vatNumber: true,
  billingAddress: true,
});

type TOrganisationUpdateFormSchema = z.infer<typeof ZOrganisationUpdateFormSchema>;

export const OrganisationUpdateForm = () => {
  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const { refreshSession } = useSession();

  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(ZOrganisationUpdateFormSchema),
    defaultValues: {
      name: organisation.name,
      url: organisation.url,
      vatNumber: organisation.vatNumber ?? '',
      billingAddress: organisation.billingAddress ?? '',
    },
  });

  const { mutateAsync: updateOrganisation } = trpc.organisation.update.useMutation();

  const onFormSubmit = async ({
    name,
    url,
    vatNumber,
    billingAddress,
  }: TOrganisationUpdateFormSchema) => {
    try {
      await updateOrganisation({
        data: {
          name,
          url,
          vatNumber,
          billingAddress,
        },
        organisationId: organisation.id,
      });

      await refreshSession();

      if (url !== organisation.url) {
        await navigate(`/o/${url}/settings`);
      }

      toast({
        title: _(msg`Success`),
        description: _(msg`Your organisation has been successfully updated.`),
        duration: 5000,
      });

      form.reset({
        name,
        url,
        vatNumber: vatNumber ?? '',
        billingAddress: billingAddress ?? '',
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('url', {
          type: 'manual',
          message: _(msg`This URL is already in use.`),
        });

        return;
      }

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to update your organisation. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Organisation Name</Trans>
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
            name="url"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel required>
                  <Trans>Organisation URL</Trans>
                </FormLabel>
                <FormControl>
                  <Input className="bg-background" {...field} />
                </FormControl>
                {!form.formState.errors.url && (
                  <span className="text-foreground/50 text-xs font-normal">
                    {field.value ? (
                      `${NEXT_PUBLIC_WEBAPP_URL()}/o/${field.value}`
                    ) : (
                      <Trans>A unique URL to identify your organisation</Trans>
                    )}
                  </span>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vatNumber"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>
                  <Trans>VAT number</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    className="bg-background"
                    placeholder="4123456789"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>
                    Optional. Required if you are a registered vendor and need to claim input VAT on
                    invoices over R5,000.
                  </Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billingAddress"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>
                  <Trans>Billing address</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-background min-h-24"
                    placeholder={_(msg`Street address, city, postal code`)}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>
                    Optional. Full tax invoices need the purchaser address shown on the Bill to
                    section.
                  </Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end space-x-4">
            <AnimatePresence>
              {form.formState.isDirty && (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                >
                  <Button type="button" variant="secondary" onClick={() => form.reset()}>
                    <Trans>Reset</Trans>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="transition-opacity"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
            >
              <Trans>Update organisation</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
