import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import {
  NEXT_PUBLIC_WEBAPP_URL,
  SUPPORT_EMAIL,
} from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamRequestBaseSchema } from '@documenso/trpc/server/team-router/create-team.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamCreateDialogProps = {
  trigger?: React.ReactNode;
  onCreated?: () => Promise<void>;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateTeamFormSchema = ZCreateTeamRequestBaseSchema.pick({
  teamName: true,
  teamUrl: true,
  inheritMembers: true,
  isPrivate: true,
  organisationMemberId: true,
});

type TCreateTeamFormSchema = z.infer<typeof ZCreateTeamFormSchema>;

export const TeamCreateDialog = ({ trigger, onCreated, ...props }: TeamCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const [open, setOpen] = useState(false);

  const { data: fullOrganisation } = trpc.organisation.get.useQuery({
    organisationReference: organisation.id,
  });

  const { data: organisationMembers } = trpc.organisation.member.find.useQuery({
    organisationId: organisation.id,
    page: 1,
    perPage: 100,
  });

  const actionSearchParam = searchParams?.get('action');

  const form = useForm({
    resolver: zodResolver(ZCreateTeamFormSchema),
    defaultValues: {
      teamName: '',
      teamUrl: '',
      inheritMembers: true,
      isPrivate: false,
      organisationMemberId: '',
    },
  });

  const { mutateAsync: createTeam } = trpc.team.create.useMutation();

  const onFormSubmit = async ({
    teamName,
    teamUrl,
    inheritMembers,
    isPrivate,
    organisationMemberId,
  }: TCreateTeamFormSchema) => {
    try {
      await createTeam({
        organisationId: organisation.id,
        teamName,
        teamUrl,
        inheritMembers,
        isPrivate,
        organisationMemberId: isPrivate ? organisationMemberId : undefined,
      });

      setOpen(false);

      await onCreated?.();
      await refreshSession();

      toast({
        title: _(msg`Success`),
        description: _(msg`Your team has been created.`),
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        const message = error.message ?? '';

        if (message.toLowerCase().includes('name')) {
          form.setError('teamName', {
            type: 'manual',
            message: _(msg`This team name is already in use in this organisation.`),
          });
        } else {
          form.setError('teamUrl', {
            type: 'manual',
            message: _(msg`This URL is already in use.`),
          });
        }

        return;
      }

      if (error.code === AppErrorCode.INVALID_BODY && error.message) {
        if (error.message.toLowerCase().includes('organisation member')) {
          form.setError('organisationMemberId', {
            type: 'manual',
            message: error.message,
          });

          return;
        }
      }

      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to create a team. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  const mapTextToUrl = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  };

  const dialogState = useMemo(() => {
    if (!fullOrganisation) {
      return 'loading';
    }

    if (fullOrganisation.organisationClaim.teamCount === 0) {
      return 'form';
    }

    if (fullOrganisation.organisationClaim.teamCount <= fullOrganisation.teams.length) {
      return 'alert';
    }

    return 'form';
  }, [fullOrganisation]);

  useEffect(() => {
    if (actionSearchParam === 'add-team') {
      setOpen(true);
      updateSearchParams({ action: null });
    }
  }, [actionSearchParam, open]);

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create team</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create team</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create a team to collaborate with your team members.</Trans>
          </DialogDescription>
        </DialogHeader>

        {dialogState === 'loading' && <SpinnerBox className="py-32" />}

        {dialogState === 'alert' && (
          <>
            <Alert
              className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
              variant="neutral"
            >
              <AlertDescription className="mt-0">
                <Trans>
                  You have reached the maximum number of teams for your plan. Please contact sales
                  at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you would like to
                  adjust your plan.
                </Trans>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>
            </DialogFooter>
          </>
        )}

        {dialogState === 'form' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="teamName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>
                        <Trans>Team Name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background"
                          {...field}
                          onChange={(event) => {
                            const oldGeneratedUrl = mapTextToUrl(field.value);
                            const newGeneratedUrl = mapTextToUrl(event.target.value);

                            const urlField = form.getValues('teamUrl');
                            if (urlField === oldGeneratedUrl) {
                              form.setValue('teamUrl', newGeneratedUrl);
                            }

                            field.onChange(event);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>
                        <Trans>Team URL</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input className="bg-background" {...field} />
                      </FormControl>
                      {!form.formState.errors.teamUrl && (
                        <span className="text-xs font-normal text-foreground/50">
                          {field.value ? (
                            `${NEXT_PUBLIC_WEBAPP_URL()}/t/${organisation.id.slice(-5)}-${field.value}`
                          ) : (
                            <Trans>A unique URL to identify your team</Trans>
                          )}
                        </span>
                      )}

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inheritMembers"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            id="inherit-members"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              // Private teams should not automatically inherit all organisation members.
                              if (form.getValues('isPrivate') && checked) {
                                return;
                              }

                              field.onChange(checked);
                            }}
                          />

                          <label
                            className="ml-2 text-sm text-muted-foreground"
                            htmlFor="inherit-members"
                          >
                            <Trans>Allow all organisation members to access this team</Trans>
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            id="is-private"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);

                              // When making the team private, ensure we do not inherit all organisation members.
                              if (checked) {
                                form.setValue('inheritMembers', false);
                              }
                            }}
                          />

                          <label
                            className="text-muted-foreground ml-2 text-sm"
                            htmlFor="is-private"
                          >
                            <Trans>Private Team - only members can see documents</Trans>
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('isPrivate') && (
                  <FormField
                    control={form.control}
                    name="organisationMemberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>
                          <Trans>Team admin</Trans>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue
                                placeholder={_(msg`Select an organisation member`)}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {organisationMembers?.data?.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name ? `${member.name} (${member.email})` : member.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <span className="text-foreground/50 text-xs font-normal">
                          <Trans>
                            Only this member will be added to the private team as an admin. No
                            organisation groups will be added automatically.
                          </Trans>
                        </span>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    data-testid="dialog-create-team-button"
                    loading={form.formState.isSubmitting}
                  >
                    <Trans>Create Team</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
