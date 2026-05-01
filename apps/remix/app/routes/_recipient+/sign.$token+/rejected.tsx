import { Trans } from '@lingui/react/macro';
import { DocumentStatus, FieldType, SigningStatus } from '@prisma/client';
import { DownloadIcon, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { getFieldsForToken } from '@documenso/lib/server-only/field/get-fields-for-token';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { DocumentSigningAuthPageView } from '~/components/general/document-signing/document-signing-auth-page';
import { truncateTitle } from '~/utils/truncate-title';

import type { Route } from './+types/rejected';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document) {
    throw new Response('Not Found', { status: 404 });
  }

  const truncatedTitle = truncateTitle(document.title);

  const [fields, recipient] = await Promise.all([
    getFieldsForToken({ token }),
    getRecipientByToken({ token }).catch(() => null),
  ]);

  if (!recipient) {
    throw new Response('Not Found', { status: 404 });
  }

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipient.authOptions,
  });

  // After rejection, the signing token is sufficient to show the confirmation (same idea as
  // `/complete` not re-requiring KBA). ACCOUNT access still applies until the recipient has
  // actually rejected, so the page cannot be used to leak envelope details before rejection.
  const isDocumentAccessValid =
    recipient.signingStatus === SigningStatus.REJECTED
      ? true
      : derivedRecipientAccessAuth.every((accessAuth) =>
          match(accessAuth)
            .with(DocumentAccessAuth.ACCOUNT, () => user && user.email === recipient.email)
            .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true)
            .with(DocumentAccessAuth.KBA, () => true)
            .exhaustive(),
        );

  const recipientReference =
    recipient.name ||
    fields.find((field) => field.type === FieldType.NAME)?.customText ||
    recipient.email;

  if (isDocumentAccessValid) {
    return {
      isDocumentAccessValid: true,
      recipientReference,
      truncatedTitle,
      document,
      recipient,
    };
  }

  // Don't leak data if access is denied.
  return {
    isDocumentAccessValid: false,
    recipientReference,
  };
}

export default function RejectedSigningPage({ loaderData }: Route.ComponentProps) {
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const { isDocumentAccessValid, recipientReference, truncatedTitle, document, recipient } =
    loaderData;

  if (!isDocumentAccessValid) {
    return <DocumentSigningAuthPageView email={recipientReference} />;
  }

  return (
    <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-44">
      <Badge variant="neutral" size="default" className="mb-6 rounded-xl border bg-transparent">
        {truncatedTitle}
      </Badge>

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-x-4">
          <XCircle className="h-10 w-10 text-destructive" />

          <h2 className="max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>Document Rejected</Trans>
          </h2>
        </div>

        <div className="mt-4 flex items-center text-center text-sm text-destructive">
          <Trans>You have rejected this document</Trans>
        </div>

        <p className="mt-6 max-w-[60ch] text-center text-sm text-muted-foreground">
          <Trans>
            The document owner has been notified of your decision. They may contact you with further
            instructions if necessary.
          </Trans>
        </p>

        <p className="mt-2 max-w-[60ch] text-center text-sm text-muted-foreground">
          <Trans>No further action is required from you at this time.</Trans>
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-4 md:w-auto md:max-w-none md:flex-row md:items-center">
          {document && isDocumentCompleted(document) && (
            <EnvelopeDownloadDialog
              envelopeId={document.envelopeId}
              envelopeStatus={document.status}
              envelopeItems={document.envelopeItems}
              token={recipient?.token}
              trigger={
                <Button type="button" variant="outline" className="flex-1 md:flex-initial">
                  <DownloadIcon className="mr-2 h-5 w-5" />
                  <Trans>Download</Trans>
                </Button>
              }
            />
          )}

          {user && (
            <Button className="flex-1 md:flex-initial" asChild>
              <Link to={`/`}>
                <Trans>Return Home</Trans>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
