import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import type { z } from 'zod';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getSiteSettings } from '@documenso/lib/server-only/site-settings/get-site-settings';
import {
  SITE_SETTINGS_BANNER_ID,
  ZSiteSettingsBannerSchema,
} from '@documenso/lib/server-only/site-settings/schemas/banner';
import {
  SITE_SETTINGS_RESELLER_ID,
  ZSiteSettingsResellerSchema,
} from '@documenso/lib/server-only/site-settings/schemas/reseller';
import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
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
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/site-settings';

const ZBannerFormSchema = ZSiteSettingsBannerSchema;
const ZResellerFormSchema = ZSiteSettingsResellerSchema;

type TBannerFormSchema = z.infer<typeof ZBannerFormSchema>;
type TResellerFormSchema = z.infer<typeof ZResellerFormSchema>;

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);
  const settings = await getSiteSettings();

  const banner = settings.find((setting) => setting.id === SITE_SETTINGS_BANNER_ID);
  const reseller = settings.find((setting) => setting.id === SITE_SETTINGS_RESELLER_ID);

  const isResellerFeatureAllowed = user?.email
    ? isResellerFeatureAllowedEmail(user.email)
    : false;

  return { banner, reseller, isResellerFeatureAllowed };
}

export default function AdminBannerPage({ loaderData }: Route.ComponentProps) {
  const { banner, reseller, isResellerFeatureAllowed } = loaderData;

  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const form = useForm<TBannerFormSchema>({
    resolver: zodResolver(ZBannerFormSchema),
    defaultValues: {
      id: SITE_SETTINGS_BANNER_ID,
      enabled: banner?.enabled ?? false,
      data: {
        content: banner?.data?.content ?? '',
        bgColor: banner?.data?.bgColor ?? '#000000',
        textColor: banner?.data?.textColor ?? '#FFFFFF',
      },
    },
  });

  const enabled = form.watch('enabled');

  const resellerForm = useForm<TResellerFormSchema>({
    resolver: zodResolver(ZResellerFormSchema),
    defaultValues: {
      id: SITE_SETTINGS_RESELLER_ID,
      enabled: reseller?.enabled ?? true,
      data: {
        termsDocGenTemplateId: reseller?.data?.termsDocGenTemplateId,
        termsDocGenWorkspaceId: reseller?.data?.termsDocGenWorkspaceId,
        termsInternalTemplateId: reseller?.data?.termsInternalTemplateId,
      },
    },
  });

  const { mutateAsync: updateSiteSetting, isPending: isUpdateSiteSettingLoading } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const onBannerUpdate = async ({ id, enabled, data }: TBannerFormSchema) => {
    try {
      await updateSiteSetting({
        id,
        enabled,
        data,
      });

      toast({
        title: _(msg`Banner Updated`),
        description: _(msg`Your banner has been updated successfully.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(
          msg`We encountered an unknown error while attempting to update the banner. Please try again later.`,
        ),
      });
    }
  };

  const onResellerUpdate = async (values: TResellerFormSchema) => {
    try {
      await updateSiteSetting(values);

      toast({
        title: _(msg`Reseller settings updated`),
        description: _(msg`Reseller T&Cs template configuration has been saved.`),
        duration: 5000,
      });

      await revalidate();
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
      });
    }
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Site Settings`)}
        subtitle={_(msg`Manage your site settings here`)}
      />

      <div className="mt-8">
        <div>
          <h2 className="font-semibold">
            <Trans>Site Banner</Trans>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              The site banner is a message that is shown at the top of the site. It can be used to
              display important information to your users.
            </Trans>
          </p>

          <Form {...form}>
            <form
              className="mt-4 flex flex-col rounded-md"
              onSubmit={form.handleSubmit(onBannerUpdate)}
            >
              <div className="mt-4 flex flex-col gap-4 md:flex-row">
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>
                        <Trans>Enabled</Trans>
                      </FormLabel>

                      <FormControl>
                        <div>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <fieldset
                  className="flex flex-col gap-4 md:flex-row"
                  disabled={!enabled}
                  aria-disabled={!enabled}
                >
                  <FormField
                    control={form.control}
                    name="data.bgColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Background Color</Trans>
                        </FormLabel>

                        <FormControl>
                          <div>
                            <ColorPicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={!enabled}
                            />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data.textColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Text Color</Trans>
                        </FormLabel>

                        <FormControl>
                          <div>
                            <ColorPicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={!enabled}
                            />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>
              </div>

              <fieldset disabled={!enabled} aria-disabled={!enabled}>
                <FormField
                  control={form.control}
                  name="data.content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Content</Trans>
                      </FormLabel>

                      <FormControl>
                        <Textarea className="h-32 resize-none" {...field} />
                      </FormControl>

                      <FormDescription>
                        <Trans>The content to show in the banner, HTML is allowed</Trans>
                      </FormDescription>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <Button
                type="submit"
                loading={isUpdateSiteSettingLoading}
                className="mt-4 justify-end self-end"
              >
                <Trans>Update Banner</Trans>
              </Button>
            </form>
          </Form>
        </div>

        {isResellerFeatureAllowed && (
        <div className="mt-12">
          <h2 className="font-semibold">
            <Trans>Reseller T&Cs</Trans>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              Configure the Nomia Africa DocGen template ID or internal E-sign template ID used when
              sending reseller terms and conditions.
            </Trans>
          </p>

          <Form {...resellerForm}>
            <form
              className="mt-4 space-y-4"
              onSubmit={resellerForm.handleSubmit(onResellerUpdate)}
            >
              <FormField
                control={resellerForm.control}
                name="data.termsDocGenTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen Template ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value ? Number(value) : undefined);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia DocGen template ID for reseller T&Cs (e.g. 127).
                      </Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.termsDocGenWorkspaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen Workspace ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value ? Number(value) : undefined);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia workspace ID (e.g. 7). Can also be set via NOMIA_DOCGEN_WORKSPACE_ID.
                      </Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.termsInternalTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Internal E-sign Template ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value ? Number(value) : undefined);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>Fallback internal template ID if DocGen is not configured.</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <Button type="submit" loading={isUpdateSiteSettingLoading}>
                <Trans>Save reseller T&Cs settings</Trans>
              </Button>
            </form>
          </Form>
        </div>
        )}
      </div>
    </div>
  );
}
