import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { WEBHOOK_SECRET_HEADER } from '@documenso/lib/constants/webhook-secret-header';
import { cn } from '@documenso/ui/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@documenso/ui/primitives/accordion';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@documenso/ui/primitives/card';
import { useToast } from '@documenso/ui/primitives/use-toast';

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

const SECTION_LINKS = [
  { id: 'overview', label: msg`Overview` },
  { id: 'events', label: msg`Events` },
  { id: 'setup', label: msg`Setup` },
  { id: 'verification', label: msg`Verification` },
  { id: 'request-format', label: msg`Request format` },
  { id: 'examples', label: msg`Payload examples` },
  { id: 'testing', label: msg`Testing` },
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

const eventAnchorId = (event: string) => event.replace('.', '-');

const CopyCodeBlock = ({ code }: { code: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [, copy] = useCopyToClipboard();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    const didCopy = await copy(code);

    if (!didCopy) {
      toast({
        title: _(msg`Unable to copy`),
        description: _(msg`Please copy the code manually.`),
        variant: 'destructive',
      });
      return;
    }

    setHasCopied(true);
    toast({
      title: _(msg`Copied to clipboard`),
    });

    window.setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };

  return (
    <div className="bg-muted/40 relative overflow-hidden rounded-lg border">
      <div className="absolute right-2 top-2 z-10">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleCopy}
          aria-label={hasCopied ? _(msg`Copied`) : _(msg`Copy`)}
        >
          {hasCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-4 pr-12 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default function WebhooksDocumentationPage() {
  const { _ } = useLingui();
  const [openExample, setOpenExample] = useState(eventAnchorId('document.created'));
  const [activeSectionId, setActiveSectionId] = useState(SECTION_LINKS[0].id);

  useEffect(() => {
    const sectionIds = SECTION_LINKS.map((section) => section.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const visibleSectionIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSectionIds.add(entry.target.id);
          } else {
            visibleSectionIds.delete(entry.target.id);
          }
        }

        const nextActiveSectionId = sectionIds.find((id) => visibleSectionIds.has(id));

        if (nextActiveSectionId) {
          setActiveSectionId(nextActiveSectionId);
        }
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleOpenExample = (event: (typeof WEBHOOK_EVENTS)[number]) => {
    const anchorId = eventAnchorId(event);
    setOpenExample(anchorId);
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/" className="shrink-0">
              <BrandingLogo className="h-8 w-auto" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <WebhookIcon className="text-muted-foreground hidden h-4 w-4 sm:block" />
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                  <Trans>Webhooks</Trans>
                </h1>
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">
                <Trans>Real-time document event notifications for your integrations</Trans>
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/reference">
              <BookOpenIcon className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">
                <Trans>API Reference</Trans>
              </span>
              <span className="sm:hidden">
                <Trans>API</Trans>
              </span>
              <ExternalLinkIcon className="ml-1.5 h-3.5 w-3.5 opacity-60" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1">
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
              <Trans>On this page</Trans>
            </p>
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setActiveSectionId(section.id)}
                className={cn(
                  'block rounded-md px-3 py-1.5 text-sm transition-colors',
                  activeSectionId === section.id
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {_(section.label)}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-10">
          <section id="overview" className="scroll-mt-28 space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">
              <Trans>Overview</Trans>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
              <Trans>
                Webhooks are HTTP callbacks triggered by document events. When you subscribe to an
                event and that event occurs, Nomia POSTs a JSON payload to the URL you provide.
              </Trans>
            </p>
          </section>

          <section id="events" className="scroll-mt-28 space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                <Trans>Supported events</Trans>
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                <Trans>Jump to a payload example for any event below.</Trans>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <a
                  key={event}
                  href={`#${eventAnchorId(event)}`}
                  onClick={() => handleOpenExample(event)}
                >
                  <Badge
                    variant="neutral"
                    className="hover:bg-muted cursor-pointer px-2.5 py-1 font-mono text-xs transition-colors"
                  >
                    {event}
                  </Badge>
                </a>
              ))}
            </div>
          </section>

          <section id="setup" className="scroll-mt-28 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">
              <Trans>Create a webhook subscription</Trans>
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {[
                msg`Open your team settings and go to the Webhooks tab.`,
                msg`Click Create Webhook and enter the callback URL.`,
                msg`Select the events you want to receive.`,
                msg`Optionally set a secret so you can verify each callback.`,
              ].map((step, index) => (
                <li key={index}>
                  <Card className="h-full">
                    <CardContent className="flex gap-3 p-4">
                      <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-relaxed">{_(step)}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </section>

          <section id="verification" className="scroll-mt-28">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-lg p-2">
                    <ShieldCheckIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      <Trans>Verifying callbacks</Trans>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <Trans>
                        When a secret is configured, Nomia sends it as a header on every webhook
                        POST. Compare the header value to the secret you stored for that webhook.
                      </Trans>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    <Trans>Header</Trans>
                  </span>
                  <code className="bg-background rounded-md border px-2 py-1 font-mono text-sm font-medium">
                    {WEBHOOK_SECRET_HEADER}
                  </code>
                </div>
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    The secret is sent as the header value itself. It is not an HMAC signature of
                    the body.
                  </Trans>
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="request-format" className="scroll-mt-28 space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">
              <Trans>Request format</Trans>
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <Trans>Method</Trans>
                  </CardDescription>
                  <CardTitle className="font-mono text-base">POST</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <Trans>Content-Type</Trans>
                  </CardDescription>
                  <CardTitle className="font-mono text-base">application/json</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <Trans>Body fields</Trans>
                  </CardDescription>
                  <CardTitle className="text-base leading-snug">
                    <code className="text-sm">event</code>, <code className="text-sm">payload</code>
                    , <code className="text-sm">createdAt</code>,{' '}
                    <code className="text-sm">webhookEndpoint</code>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          </section>

          <section id="examples" className="scroll-mt-28 space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                <Trans>Example payloads</Trans>
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                <Trans>
                  Expand an event to inspect or copy its JSON payload. Payloads are sent in the body
                  of the POST request.
                </Trans>
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              value={openExample}
              onValueChange={setOpenExample}
              className="rounded-xl border"
            >
              {WEBHOOK_PAYLOAD_EXAMPLES.map(({ event, payload }) => (
                <AccordionItem
                  key={event}
                  value={eventAnchorId(event)}
                  id={eventAnchorId(event)}
                  className="scroll-mt-28 px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-left">
                      <Badge variant="neutral" className="font-mono text-xs">
                        {event}
                      </Badge>
                      <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
                        <Trans>Example payload</Trans>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CopyCodeBlock code={payload} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <section id="testing" className="scroll-mt-28 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Trans>Testing and resending</Trans>
                </CardTitle>
                <CardDescription>
                  <Trans>
                    From a webhook&apos;s detail page you can send a test event or open call logs.
                    Failed or successful deliveries can be resent from the call detail view.
                  </Trans>
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Trans>Availability</Trans>
                </CardTitle>
                <CardDescription>
                  <Trans>Webhooks are available on teams.</Trans>
                </CardDescription>
              </CardHeader>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
