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
  DEFAULT_RESELLER_TERMS_PROVIDER,
  RESELLER_TERMS_PROVIDER,
  SITE_SETTINGS_RESELLER_ID,
  ZSiteSettingsResellerSchema,
  resolveResellerTermsProvider,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/site-settings';

const ZBannerFormSchema = ZSiteSettingsBannerSchema;
const ZResellerFormSchema = ZSiteSettingsResellerSchema;

type TBannerFormSchema = z.infer<typeof ZBannerFormSchema>;
type TResellerFormSchema = z.infer<typeof ZResellerFormSchema>;

const toOptionalSiteSettingId = (value: number | null | undefined) =>
  value && value > 0 ? value : undefined;

const parseOptionalSiteSettingIdInput = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return undefined;
  }

  const parsed = Number(digits);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

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
        termsProvider: resolveResellerTermsProvider(reseller?.data?.termsProvider),
        termsDocGenTemplateId: toOptionalSiteSettingId(reseller?.data?.termsDocGenTemplateId),
        termsDocGenOrganizationId: toOptionalSiteSettingId(
          reseller?.data?.termsDocGenOrganizationId,
        ),
        termsDocGenWorkspaceId: toOptionalSiteSettingId(reseller?.data?.termsDocGenWorkspaceId),
        termsInternalTemplateId: toOptionalSiteSettingId(reseller?.data?.termsInternalTemplateId),
        docGenApiUrl: reseller?.data?.docGenApiUrl ?? '',
        docGenAuthToken: reseller?.data?.docGenAuthToken ?? '',
        docGenApiKey: reseller?.data?.docGenApiKey ?? '',
        // Always use pdf_link; not exposed in the UI.
        docGenApiEndpoint: 'pdf_link',
        docGenEsignApiKey: reseller?.data?.docGenEsignApiKey ?? '',
      },
    },
  });

  const termsProvider =
    resellerForm.watch('data.termsProvider') ?? DEFAULT_RESELLER_TERMS_PROVIDER;
  const usesNomiaDocGen = termsProvider === RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN;

  const { mutateAsync: updateBannerSetting, isPending: isUpdatingBanner } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const { mutateAsync: updateResellerSetting, isPending: isUpdatingReseller } =
    trpcReact.admin.updateSiteSetting.useMutation();

  const onBannerUpdate = async ({ id, enabled, data }: TBannerFormSchema) => {
    try {
      await updateBannerSetting({
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
      await updateResellerSetting(values);

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
                loading={isUpdatingBanner}
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
              Choose whether reseller terms are sent via Nomia DocGen or an internal e-sign
              template, then configure the matching settings.
            </Trans>
          </p>

          <Form {...resellerForm}>
            <form
              className="mt-4 space-y-4"
              onSubmit={resellerForm.handleSubmit(onResellerUpdate)}
            >
              <FormField
                control={resellerForm.control}
                name="data.termsProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>T&Cs provider</Trans>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={RESELLER_TERMS_PROVIDER.NOMIA_DOCGEN}>
                          <Trans>Nomia DocGen</Trans>
                        </SelectItem>
                        <SelectItem value={RESELLER_TERMS_PROVIDER.INTERNAL}>
                          <Trans>Internal e-sign template</Trans>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      <Trans>
                        Defaults to Nomia DocGen. Switch to Internal to send from a Documenso
                        template instead.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {usesNomiaDocGen ? (
                <>
              <FormField
                control={resellerForm.control}
                name="data.docGenApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen API URL</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="https://api.nomiadocs.com"
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia DocGen API base URL. Leave blank to use the default production URL.
                      </Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.docGenAuthToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen Auth Token</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="off"
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>Sent in the Authorization header for DocGen API requests.</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.docGenApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen API Key</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="off"
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>Workspace API key sent in the request body as api_key.</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.docGenEsignApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen E-sign API Key</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="off"
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Default e-sign API key used when sending reseller T&Cs for e-signing.
                      </Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={resellerForm.control}
                name="data.termsDocGenOrganizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>DocGen Organization ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Set organization ID"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          field.onChange(parseOptionalSiteSettingIdInput(event.target.value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia organization ID used to fetch template variables (e.g. 20). Leave
                        blank until you set it.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Set template ID"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          field.onChange(parseOptionalSiteSettingIdInput(event.target.value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia DocGen template ID for reseller T&Cs (e.g. 127). Leave blank until you
                        set it.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
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
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Set workspace ID"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          field.onChange(parseOptionalSiteSettingIdInput(event.target.value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Nomia workspace ID (e.g. 35). Leave blank until you set it.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </>
              ) : (
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
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Set internal template ID"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          field.onChange(parseOptionalSiteSettingIdInput(event.target.value));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Documenso template ID used when the T&Cs provider is set to Internal.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}

              <Button type="submit" loading={isUpdatingReseller}>
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
