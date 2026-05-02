import { useMemo, useState } from 'react';

import { msg, plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { buildDropzoneRejectionDescription } from '@documenso/ui/lib/handle-dropzone-rejection';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentUploadButton } from '@documenso/ui/primitives/document-upload-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type EnvelopeUploadButtonProps = {
  className?: string;
  type: EnvelopeType;
  folderId?: string;
};

/**
 * Upload an envelope
 */
export const EnvelopeUploadButton = ({ className, type, folderId }: EnvelopeUploadButtonProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const userTimezone = TIME_ZONES.find(
    (timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const { quota, remaining, refreshLimits, maximumEnvelopeItemCount } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createEnvelope } = trpc.envelope.create.useMutation();

  const disabledMessage = useMemo(() => {
    const isOrganisationOwner = organisation.ownerUserId === user.id;
    const isOwnerNonMember = isOrganisationOwner && !team.isTeamMember;

    if (isOwnerNonMember) {
      return msg`You must be a member of this team to upload documents.`;
    }

    if (organisation.subscription && remaining.documents === 0) {
      return msg`Document upload disabled due to unpaid invoices`;
    }

    if (!user.emailVerified) {
      return msg`Verify your email to upload documents.`;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation.subscription, remaining.documents, user.emailVerified, team]);

  const onFileDrop = async (files: File[]) => {
    // Check if user has no credits remaining
    if (type === EnvelopeType.DOCUMENT && (remaining.documents === 0 || remaining.documents === null)) {
      toast({
        title: t`Upload failed`,
        description: t`You have reached your document limit. Please upgrade your plan to upload more documents.`,
        variant: 'destructive',
        duration: 7500,
      });
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        folderId,
        type,
        title: files[0].name,
        meta: {
          timezone: userTimezone,
        },
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      const { id } = await createEnvelope(formData).catch((error) => {
        console.error(error);

        throw error;
      });

      void refreshLimits();

      const pathPrefix =
        type === EnvelopeType.DOCUMENT
          ? formatDocumentsPath(team.url)
          : formatTemplatesPath(team.url);

      const aiQueryParam = team.preferences.aiFeaturesEnabled ? '?ai=false' : '';

      await navigate(`${pathPrefix}/${id}/edit${aiQueryParam}`);

      toast({
        title: type === EnvelopeType.DOCUMENT ? t`Document uploaded` : t`Template uploaded`,
        description:
          type === EnvelopeType.DOCUMENT
            ? t`Your document has been uploaded successfully.`
            : t`Your template has been uploaded successfully.`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(err);

      const errorMessage = match(error.code)
        .with('INVALID_DOCUMENT_FILE', () => t`You cannot upload encrypted PDFs.`)
        .with(
          AppErrorCode.LIMIT_EXCEEDED,
          () => t`You have reached your document limit. Please upgrade your plan.`,
        )
        .with(
          'ENVELOPE_ITEM_LIMIT_EXCEEDED',
          () => t`You have reached the limit of the number of files per envelope.`,
        )
        .otherwise(() => t`An error occurred while uploading your document.`);

      toast({
        title: t`Error`,
        description: errorMessage,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    toast({
      title: t`Upload failed`,
      description: i18n._(buildDropzoneRejectionDescription(fileRejections)),
      duration: 5000,
      variant: 'destructive',
    });
  };

  const isOrganisationOwner = organisation.ownerUserId === user.id;
  const isOwnerNonMember = isOrganisationOwner && !team.isTeamMember;

  const isDisabled = !user.emailVerified || isOwnerNonMember;
  const hasNoCredits = type === EnvelopeType.DOCUMENT && (remaining.documents === 0 || remaining.documents === null);
  const showCreditsInfo = type === EnvelopeType.DOCUMENT && typeof remaining.documents === 'number';

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DocumentUploadButton
                loading={isLoading}
                disabled={isDisabled}
                disabledMessage={disabledMessage}
                variant={hasNoCredits ? 'default' : 'default'}
                onDrop={onFileDrop}
                onDropRejected={onFileDropRejected}
                type={type}
                internalVersion="2"
                maxFiles={maximumEnvelopeItemCount}
              />
            </div>
          </TooltipTrigger>

          {showCreditsInfo && remaining.documents > 0 && (
            <TooltipContent>
              <p className="text-sm">
                <Trans>
                  {remaining.documents} envelopes remaining
                </Trans>
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Always show remaining credits under the button */}
      {showCreditsInfo && (
        <p className={cn(
          "text-xs text-center",
          hasNoCredits ? "text-muted-foreground" : "text-muted-foreground"
        )}>
          <Trans>
            {remaining.documents} envelopes remaining
          </Trans>
        </p>
      )}
    </div>
  );
};
