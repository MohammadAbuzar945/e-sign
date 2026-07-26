import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';

const ZResellerAffiliatePageFormSchema = z.object({
  affiliatePageTitle: z.string().max(120).optional(),
  affiliatePageDescription: z.string().max(300).optional(),
  brandingPrimaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: msg`Must be a valid hex color (e.g. #FF6600)`.id })
    .optional()
    .or(z.literal('')),
  affiliateAboutText: z.string().max(1000).optional(),
  affiliateSupportEmail: z
    .union([
      z.string().email({ message: msg`Enter a valid email address`.id }),
      z.literal(''),
    ])
    .optional(),
  highlightedCatalogPackageId: z.string().optional(),
});

export type TResellerAffiliatePageFormSchema = z.infer<typeof ZResellerAffiliatePageFormSchema>;

type ResellerAffiliatePageFormProps = {
  profile: {
    affiliatePageTitle: string | null;
    affiliatePageDescription: string | null;
    brandingPrimaryColor: string | null;
    affiliateAboutText: string | null;
    affiliateSupportEmail: string | null;
    highlightedCatalogPackageId: string | null;
    packages: Array<{
      catalogPackageId: string;
      isEnabled: boolean;
    }>;
    catalogPackages: Array<{
      id: string;
      name: string;
    }>;
  };
  onFormSubmit: (data: TResellerAffiliatePageFormSchema) => Promise<void>;
};

export const ResellerAffiliatePageForm = ({
  profile,
  onFormSubmit,
}: ResellerAffiliatePageFormProps) => {
  const { t } = useLingui();

  const enabledPackages = profile.packages.filter((pkg) => pkg.isEnabled);

  const form = useForm<TResellerAffiliatePageFormSchema>({
    resolver: zodResolver(ZResellerAffiliatePageFormSchema),
    values: {
      affiliatePageTitle: profile.affiliatePageTitle ?? '',
      affiliatePageDescription: profile.affiliatePageDescription ?? '',
      brandingPrimaryColor: profile.brandingPrimaryColor ?? '',
      affiliateAboutText: profile.affiliateAboutText ?? '',
      affiliateSupportEmail: profile.affiliateSupportEmail ?? '',
      highlightedCatalogPackageId: profile.highlightedCatalogPackageId ?? '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <FormField
            control={form.control}
            name="affiliatePageTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Page title</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t`Buy e-sign credits`} />
                </FormControl>
                <FormDescription>
                  <Trans>Custom headline shown at the top of your affiliate page</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="affiliatePageDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Page description</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t`Purchase credits from your organisation`} />
                </FormControl>
                <FormDescription>
                  <Trans>Short subtitle shown below the page title</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandingPrimaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Brand color</Trans>
                </FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <Input {...field} placeholder="#6366F1" className="max-w-[160px]" />
                  </FormControl>
                  <input
                    type="color"
                    value={field.value || '#6366F1'}
                    onChange={(event) => field.onChange(event.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border"
                    aria-label={t`Pick brand color`}
                  />
                </div>
                <FormDescription>
                  <Trans>Used for buy buttons and highlights on your affiliate page</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="affiliateAboutText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>About section</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={t`Tell clients why they should buy credits from you`}
                    className="min-h-[100px] resize-y"
                  />
                </FormControl>
                <FormDescription>
                  <Trans>Displayed above the package options on your affiliate page</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="affiliateSupportEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Support email</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="support@example.com" />
                </FormControl>
                <FormDescription>
                  <Trans>Optional contact email shown on your affiliate page</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="highlightedCatalogPackageId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Featured package</Trans>
                </FormLabel>
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t`Select a package`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">
                      <Trans>None</Trans>
                    </SelectItem>
                    {enabledPackages.map((pkg) => {
                      const catalog = profile.catalogPackages.find(
                        (item) => item.id === pkg.catalogPackageId,
                      );

                      return (
                        <SelectItem key={pkg.catalogPackageId} value={pkg.catalogPackageId}>
                          {catalog?.name ?? pkg.catalogPackageId}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormDescription>
                  <Trans>Highlight a recommended package with a badge on your affiliate page</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" loading={form.formState.isSubmitting}>
            <Trans>Save page settings</Trans>
          </Button>
        </fieldset>
      </form>
    </Form>
  );
};
