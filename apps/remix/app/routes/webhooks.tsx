import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import {
  LEGACY_WEBHOOK_SECRET_HEADER,
  WEBHOOK_SECRET_HEADER,
  WEBHOOK_SECRET_HEADER_CUTOFF,
} from '@documenso/lib/constants/webhook-secret-header';

import { BrandingLogo } from '~/components/general/branding-logo';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Webhooks');
}

const WEBHOOK_EVENTS = [
  'document.created',
  'document.sent',
  'document.opened',
  'document.signed',
  'document.completed',
  'document.rejected',
  'document.cancelled',
] as const;

const WEBHOOK_PAYLOAD_EXAMPLES: Array<{ event: (typeof WEBHOOK_EVENTS)[number]; payload: string }> =
  [
    {
      event: 'document.created',
      payload: `{
  "event": "DOCUMENT_CREATED",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "DRAFT",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:44:43.341Z",
    "completedAt": null,
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 52,
        "documentId": 10,
        "templateId": null,
        "email": "signer@nomiadocs.com",
        "name": "John Doe",
        "token": "vbT8hi3jKQmrFP_LN1WcS",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": null,
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "NOT_OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "NOT_SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:44:44.779Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.sent',
      payload: `{
  "event": "DOCUMENT_SENT",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "PENDING",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:48:07.569Z",
    "completedAt": null,
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 52,
        "documentId": 10,
        "templateId": null,
        "email": "signer2@nomiadocs.com",
        "name": "Signer 2",
        "token": "vbT8hi3jKQmrFP_LN1WcS",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": null,
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "VIEWER",
        "readStatus": "NOT_OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "SENT"
      },
      {
        "id": 53,
        "documentId": 10,
        "templateId": null,
        "email": "signer1@nomiadocs.com",
        "name": "Signer 1",
        "token": "HkrptwS42ZBXdRKj1TyUo",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": null,
        "signingOrder": 2,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "NOT_OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:48:07.945Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.opened',
      payload: `{
  "event": "DOCUMENT_OPENED",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "PENDING",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:48:07.569Z",
    "completedAt": null,
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 52,
        "documentId": 10,
        "templateId": null,
        "email": "signer2@nomiadocs.com",
        "name": "Signer 2",
        "token": "vbT8hi3jKQmrFP_LN1WcS",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": null,
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "VIEWER",
        "readStatus": "OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:50:26.174Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.signed',
      payload: `{
  "event": "DOCUMENT_SIGNED",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "COMPLETED",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:52:05.708Z",
    "completedAt": "2024-04-22T11:52:05.707Z",
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 51,
        "documentId": 10,
        "templateId": null,
        "email": "signer1@nomiadocs.com",
        "name": "Signer 1",
        "token": "HkrptwS42ZBXdRKj1TyUo",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": "2024-04-22T11:52:05.688Z",
        "authOptions": {
          "accessAuth": null,
          "actionAuth": null
        },
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "OPENED",
        "signingStatus": "SIGNED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:52:18.577Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.completed',
      payload: `{
  "event": "DOCUMENT_COMPLETED",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "COMPLETED",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:52:05.708Z",
    "completedAt": "2024-04-22T11:52:05.707Z",
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 50,
        "documentId": 10,
        "templateId": null,
        "email": "signer2@nomiadocs.com",
        "name": "Signer 2",
        "token": "vbT8hi3jKQmrFP_LN1WcS",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": "2024-04-22T11:51:10.055Z",
        "authOptions": {
          "accessAuth": null,
          "actionAuth": null
        },
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "VIEWER",
        "readStatus": "OPENED",
        "signingStatus": "SIGNED",
        "sendStatus": "SENT"
      },
      {
        "id": 51,
        "documentId": 10,
        "templateId": null,
        "email": "signer1@nomiadocs.com",
        "name": "Signer 1",
        "token": "HkrptwS42ZBXdRKj1TyUo",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": "2024-04-22T11:52:05.688Z",
        "authOptions": {
          "accessAuth": null,
          "actionAuth": null
        },
        "signingOrder": 2,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "OPENED",
        "signingStatus": "SIGNED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:52:18.277Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.rejected',
      payload: `{
  "event": "DOCUMENT_REJECTED",
  "payload": {
    "id": 10,
    "externalId": null,
    "userId": 1,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "PENDING",
    "documentDataId": "hs8qz1ktr9204jn7mg6c5dxy0",
    "createdAt": "2024-04-22T11:44:43.341Z",
    "updatedAt": "2024-04-22T11:48:07.569Z",
    "completedAt": null,
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "doc_meta_123",
      "subject": "Please sign this document",
      "message": "Hello, please review and sign this document.",
      "timezone": "UTC",
      "password": null,
      "dateFormat": "MM/DD/YYYY",
      "redirectUrl": null,
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": null
    },
    "Recipient": [
      {
        "id": 52,
        "documentId": 10,
        "templateId": null,
        "email": "signer@nomiadocs.com",
        "name": "Signer",
        "token": "vbT8hi3jKQmrFP_LN1WcS",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": "2024-04-22T11:48:07.569Z",
        "authOptions": {
          "accessAuth": null,
          "actionAuth": null
        },
        "signingOrder": 1,
        "rejectionReason": "I do not agree with the terms",
        "role": "SIGNER",
        "readStatus": "OPENED",
        "signingStatus": "REJECTED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2024-04-22T11:48:07.945Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
    {
      event: 'document.cancelled',
      payload: `{
  "event": "DOCUMENT_CANCELLED",
  "payload": {
    "id": 7,
    "externalId": null,
    "userId": 3,
    "authOptions": null,
    "formValues": null,
    "visibility": "EVERYONE",
    "title": "nomia.pdf",
    "status": "PENDING",
    "documentDataId": "cm6exvn93006hi02ru90a265a",
    "createdAt": "2025-01-27T11:02:14.393Z",
    "updatedAt": "2025-01-27T11:03:16.387Z",
    "completedAt": null,
    "deletedAt": null,
    "teamId": null,
    "templateId": null,
    "source": "DOCUMENT",
    "documentMeta": {
      "id": "cm6exvn96006ji02rqvzjvwoy",
      "subject": "",
      "message": "",
      "timezone": "Etc/UTC",
      "password": null,
      "dateFormat": "yyyy-MM-dd hh:mm a",
      "redirectUrl": "",
      "signingOrder": "PARALLEL",
      "typedSignatureEnabled": true,
      "language": "en",
      "distributionMethod": "EMAIL",
      "emailSettings": {
        "documentDeleted": true,
        "documentPending": true,
        "recipientSigned": true,
        "recipientRemoved": true,
        "documentCompleted": true,
        "ownerDocumentCompleted": true,
        "recipientSigningRequest": true
      }
    },
    "recipients": [
      {
        "id": 7,
        "documentId": 7,
        "templateId": null,
        "email": "signer@nomiadocs.com",
        "name": "Signer",
        "token": "XkKx1HCs6Znm2UBJA2j6o",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": { "accessAuth": null, "actionAuth": null },
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "NOT_OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "SENT"
      }
    ],
    "Recipient": [
      {
        "id": 7,
        "documentId": 7,
        "templateId": null,
        "email": "signer@nomiadocs.com",
        "name": "Signer",
        "token": "XkKx1HCs6Znm2UBJA2j6o",
        "documentDeletedAt": null,
        "expired": null,
        "signedAt": null,
        "authOptions": { "accessAuth": null, "actionAuth": null },
        "signingOrder": 1,
        "rejectionReason": null,
        "role": "SIGNER",
        "readStatus": "NOT_OPENED",
        "signingStatus": "NOT_SIGNED",
        "sendStatus": "SENT"
      }
    ]
  },
  "createdAt": "2025-01-27T11:03:27.730Z",
  "webhookEndpoint": "https://mywebhooksite.com/mywebhook"
}`,
    },
  ];

export default function WebhooksDocumentationPage() {
  const cutoffLabel = WEBHOOK_SECRET_HEADER_CUTOFF.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link to="/">
            <BrandingLogo className="h-8 w-auto" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <Trans>Webhooks</Trans>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <Trans>Real-time document event notifications for your integrations</Trans>
            </p>
          </div>
        </div>
      </div>

      <article className="prose dark:prose-invert mx-auto max-w-3xl px-6 py-10">
        <p>
          <Trans>
            Webhooks are HTTP callbacks triggered by document events. When you subscribe to an event
            and that event occurs, Nomia POSTs a JSON payload to the URL you provide.
          </Trans>
        </p>

        <h2>
          <Trans>Supported events</Trans>
        </h2>
        <ul>
          {WEBHOOK_EVENTS.map((event) => (
            <li key={event}>
              <a href={`#${event.replace('.', '-')}`}>
                <code>{event}</code>
              </a>
            </li>
          ))}
        </ul>

        <h2>
          <Trans>Create a webhook subscription</Trans>
        </h2>
        <ol>
          <li>
            <Trans>Open your team settings and go to the Webhooks tab.</Trans>
          </li>
          <li>
            <Trans>Click Create Webhook and enter the callback URL.</Trans>
          </li>
          <li>
            <Trans>Select the events you want to receive.</Trans>
          </li>
          <li>
            <Trans>
              Optionally set a secret. Nomia includes that value in a request header so you can
              verify the callback is genuine.
            </Trans>
          </li>
        </ol>

        <h2>
          <Trans>Verifying callbacks</Trans>
        </h2>
        <p>
          <Trans>
            When a secret is configured, Nomia sends it as a header on every webhook POST. Compare
            the header value to the secret you stored for that webhook.
          </Trans>
        </p>
        <ul>
          <li>
            <Trans>
              New webhooks (created on or after {cutoffLabel}) use the{' '}
              <code>{WEBHOOK_SECRET_HEADER}</code> header.
            </Trans>
          </li>
          <li>
            <Trans>
              Existing webhooks created before that date continue to use the legacy{' '}
              <code>{LEGACY_WEBHOOK_SECRET_HEADER}</code> header so current integrations keep
              working.
            </Trans>
          </li>
        </ul>
        <p>
          <Trans>
            The secret is sent as the header value itself. It is not an HMAC signature of the body.
          </Trans>
        </p>

        <h2>
          <Trans>Request format</Trans>
        </h2>
        <ul>
          <li>
            <Trans>
              Method: <code>POST</code>
            </Trans>
          </li>
          <li>
            <Trans>
              Content-Type: <code>application/json</code>
            </Trans>
          </li>
          <li>
            <Trans>
              Body fields: <code>event</code>, <code>payload</code> (document + recipients),{' '}
              <code>createdAt</code>, <code>webhookEndpoint</code>
            </Trans>
          </li>
        </ul>

        <h2>
          <Trans>Example payloads</Trans>
        </h2>
        <p>
          <Trans>
            Below are examples of the payloads sent for each supported event. Payloads are JSON in
            the body of the POST request.
          </Trans>
        </p>

        {WEBHOOK_PAYLOAD_EXAMPLES.map(({ event, payload }) => (
          <section key={event} id={event.replace('.', '-')} className="scroll-mt-8">
            <h3>
              <Trans>
                Example payload for the <code>{event}</code> event
              </Trans>
            </h3>
            <pre>
              <code>{payload}</code>
            </pre>
          </section>
        ))}

        <h2>
          <Trans>Testing and resending</Trans>
        </h2>
        <p>
          <Trans>
            From a webhook&apos;s detail page you can send a test event or open call logs. Failed or
            successful deliveries can be resent from the call detail view.
          </Trans>
        </p>

        <h2>
          <Trans>Availability</Trans>
        </h2>
        <p>
          <Trans>Webhooks are available on teams.</Trans>
        </p>

        <p className="not-prose mt-10">
          <Link
            to="/reference"
            className="text-primary text-sm font-medium underline underline-offset-4"
          >
            <Trans>View API Reference</Trans>
          </Link>
        </p>
      </article>
    </div>
  );
}
