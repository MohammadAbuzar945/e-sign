import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import {
  AFFILIATE_SLUG_MAX_LENGTH,
  buildAffiliateUrl,
  normalizeAffiliateSlugInput,
} from '@documenso/lib/utils/affiliate-slug';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
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

const ZResellerAffiliateSlugFormSchema = z.object({
  affiliateSlug: z.string().min(1, { message: msg`Affiliate URL is required.`.id }),
});

export type TResellerAffiliateSlugFormSchema = z.infer<typeof ZResellerAffiliateSlugFormSchema>;

type ResellerAffiliateSlugFormProps = {
  organisationId: string;
  affiliateSlug: string;
  suggestedSlug: string;
};

export const ResellerAffiliateSlugForm = ({
  organisationId,
  affiliateSlug,
  suggestedSlug,
}: ResellerAffiliateSlugFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();

  const form = useForm<TResellerAffiliateSlugFormSchema>({
    resolver: zodResolver(ZResellerAffiliateSlugFormSchema),
    values: {
      affiliateSlug,
    },
  });

  const watchedSlug = form.watch('affiliateSlug');
  const debouncedSlug = useDebouncedValue(watchedSlug, 400);
  const normalizedSlug = normalizeAffiliateSlugInput(watchedSlug);
  const hasSlugChanged = normalizedSlug !== affiliateSlug;

  const previewUrl = useMemo(() => {
    if (!normalizedSlug) {
      return buildAffiliateUrl(affiliateSlug, baseUrl);
    }

    return buildAffiliateUrl(normalizedSlug, baseUrl);
  }, [affiliateSlug, baseUrl, normalizedSlug]);

  const { data: availability, isFetching: isCheckingAvailability } =
    trpc.organisation.reseller.checkAffiliateSlug.useQuery(
      {
        organisationId,
        affiliateSlug: debouncedSlug,
      },
      {
        enabled: Boolean(debouncedSlug.trim()) && hasSlugChanged,
      },
    );

  useEffect(() => {
    if (!hasSlugChanged || !availability) {
      return;
    }

    if (!availability.isValid) {
      form.setError('affiliateSlug', {
        message: availability.message ?? msg`Invalid affiliate URL.`.id,
      });
      return;
    }

    if (!availability.isAvailable) {
      form.setError('affiliateSlug', {
        message: availability.message ?? msg`This affiliate URL is already in use.`.id,
      });
      return;
    }

    form.clearErrors('affiliateSlug');
  }, [availability, form, hasSlugChanged]);

  const { mutateAsync: updateAffiliateSlug, isPending: isUpdatingAffiliateSlug } =
    trpc.organisation.reseller.updateAffiliateSlug.useMutation({
      onSuccess: async () => {
        await utils.organisation.reseller.getProfile.invalidate({ organisationId });
        toast({ title: _(msg`Affiliate URL updated`) });
      },
      onError: (error) => {
        toast({
          title: _(msg`Update failed`),
          description: AppError.parseError(error).message,
          variant: 'destructive',
        });
      },
    });

  const canSave =
    hasSlugChanged &&
    availability?.isValid === true &&
    availability?.isAvailable === true &&
    !isCheckingAvailability;

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        autoComplete="off"
        onSubmit={form.handleSubmit(async (values) => {
          await updateAffiliateSlug({
            organisationId,
            affiliateSlug: values.affiliateSlug,
          });
        })}
      >
        <fieldset disabled={isUpdatingAffiliateSlug} className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              <Trans>Affiliate link</Trans>
            </h2>
            <p className="text-sm text-muted-foreground">
              <Trans>
                Choose a unique URL for your public reseller page. We suggest using your organisation
                URL when it is available.
              </Trans>
            </p>
          </div>

          <FormField
            control={form.control}
            name="affiliateSlug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Affiliate URL</Trans>
                </FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">/r/</span>
                    <Input
                      {...field}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={AFFILIATE_SLUG_MAX_LENGTH}
                      placeholder={suggestedSlug || 'your-brand'}
                      onChange={(event) => {
                        field.onChange(normalizeAffiliateSlugInput(event.target.value));
                      }}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  <Trans>
                    Use lowercase letters, numbers, and hyphens only. Minimum 3 characters.
                  </Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Alert variant="neutral">
            <AlertTitle>
              <Trans>Preview</Trans>
            </AlertTitle>
            <AlertDescription className="mt-2 flex items-center gap-2">
              <span className="break-all">{previewUrl}</span>
              <CopyTextButton
                value={previewUrl}
                onCopySuccess={() => toast({ title: _(msg`Link copied`) })}
              />
            </AlertDescription>
          </Alert>

          {hasSlugChanged ? (
            <Alert variant="warning">
              <AlertTitle>
                <Trans>Changing your affiliate URL</Trans>
              </AlertTitle>
              <AlertDescription>
                <Trans>
                  Your previous link will stop working after you save. Update any marketing materials
                  or client bookmarks with the new URL.
                </Trans>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSave || isUpdatingAffiliateSlug}>
              <Trans>Save affiliate URL</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
