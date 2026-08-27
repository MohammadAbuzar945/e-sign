import { useEffect, useRef, useState, type MouseEvent } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, CopyIcon } from 'lucide-react';
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
import { Button } from '@documenso/ui/primitives/button';
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

type SectionId = (typeof SECTION_LINKS)[number]['id'];

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

const HEADER_OFFSET_PX = 96;

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
    <div className="bg-muted/30 relative overflow-hidden rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1.5 top-1.5 z-10 h-7 w-7 p-0"
        onClick={handleCopy}
        aria-label={hasCopied ? _(msg`Copied`) : _(msg`Copy`)}
      >
        {hasCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </Button>
      <pre className="max-h-[28rem] overflow-auto p-4 pr-11 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default function WebhooksDocumentationPage() {
  const { _ } = useLingui();
  const [openExample, setOpenExample] = useState(eventAnchorId('document.created'));
  const [activeSectionId, setActiveSectionId] = useState<SectionId>(SECTION_LINKS[0].id);
  const isProgrammaticScrollRef = useRef(false);

  const scrollToId = (elementId: string) => {
    const element = document.getElementById(elementId);

    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    });
  };

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
        if (isProgrammaticScrollRef.current) {
          return;
        }

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

    const hash = window.location.hash.replace('#', '');

    if (hash) {
      const matchedSection = sectionIds.find((id) => id === hash);
      const matchedEvent = WEBHOOK_EVENTS.find((event) => eventAnchorId(event) === hash);

      if (matchedSection) {
        setActiveSectionId(matchedSection);
        window.requestAnimationFrame(() => scrollToId(matchedSection));
      }

      if (matchedEvent) {
        setOpenExample(eventAnchorId(matchedEvent));
        window.requestAnimationFrame(() => scrollToId(eventAnchorId(matchedEvent)));
      }
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleSectionClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: SectionId) => {
    event.preventDefault();

    isProgrammaticScrollRef.current = true;
    setActiveSectionId(sectionId);
    window.history.replaceState(null, '', `#${sectionId}`);
    scrollToId(sectionId);

    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 900);
  };

  const handleOpenExample = (
    mouseEvent: MouseEvent<HTMLAnchorElement>,
    eventName: (typeof WEBHOOK_EVENTS)[number],
  ) => {
    mouseEvent.preventDefault();

    const anchorId = eventAnchorId(eventName);
    setOpenExample(anchorId);
    setActiveSectionId('examples');
    window.history.replaceState(null, '', `#${anchorId}`);

    window.setTimeout(() => {
      scrollToId(anchorId);
    }, 50);
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="shrink-0">
              <BrandingLogo className="h-7 w-auto" />
            </Link>
            <div className="bg-border h-5 w-px" />
            <h1 className="text-base font-medium">
              <Trans>Webhooks</Trans>
            </h1>
          </div>

          <Link
            to="/reference"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            <Trans>API Reference</Trans>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5">
            <p className="text-muted-foreground mb-2 text-xs">
              <Trans>On this page</Trans>
            </p>
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(event) => handleSectionClick(event, section.id)}
                className={cn(
                  'block border-l-2 py-1.5 pl-3 text-sm transition-colors',
                  activeSectionId === section.id
                    ? 'border-foreground text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {_(section.label)}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-12 text-sm leading-relaxed sm:text-[15px]">
          <section id="overview" className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-semibold">
              <Trans>Overview</Trans>
            </h2>
            <p className="text-muted-foreground">
              <Trans>
                Webhooks notify your app when something happens to a document. Subscribe to an event,
                and Nomia will POST a JSON payload to your URL whenever that event fires.
              </Trans>
            </p>
          </section>

          <section id="events" className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-semibold">
              <Trans>Supported events</Trans>
            </h2>
            <ul className="text-muted-foreground space-y-1.5">
              {WEBHOOK_EVENTS.map((event) => (
                <li key={event}>
                  <a
                    href={`#${eventAnchorId(event)}`}
                    onClick={(mouseEvent) => handleOpenExample(mouseEvent, event)}
                    className="text-foreground font-mono text-[13px] underline-offset-4 hover:underline"
                  >
                    {event}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section id="setup" className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-semibold">
              <Trans>Create a webhook subscription</Trans>
            </h2>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5">
              <li>
                <Trans>Open team settings and go to Webhooks.</Trans>
              </li>
              <li>
                <Trans>Create a webhook and enter your callback URL.</Trans>
              </li>
              <li>
                <Trans>Select the events you want to receive.</Trans>
              </li>
              <li>
                <Trans>Optionally add a secret to verify incoming requests.</Trans>
              </li>
            </ol>
          </section>

          <section id="verification" className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-semibold">
              <Trans>Verifying callbacks</Trans>
            </h2>
            <p className="text-muted-foreground">
              <Trans>
                If you set a secret, Nomia includes it on every webhook POST. Compare that header
                value with the secret you stored.
              </Trans>
            </p>
            <p>
              <span className="text-muted-foreground">
                <Trans>Header:</Trans>{' '}
              </span>
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[13px]">
                {WEBHOOK_SECRET_HEADER}
              </code>
            </p>
          </section>

          <section id="request-format" className="scroll-mt-28 space-y-3">
            <h2 className="text-lg font-semibold">
              <Trans>Request format</Trans>
            </h2>
            <ul className="text-muted-foreground space-y-1.5">
              <li>
                <Trans>
                  Method: <code className="text-foreground font-mono text-[13px]">POST</code>
                </Trans>
              </li>
              <li>
                <Trans>
                  Content-Type:{' '}
                  <code className="text-foreground font-mono text-[13px]">application/json</code>
                </Trans>
              </li>
              <li>
                <Trans>
                  Body: <code className="text-foreground font-mono text-[13px]">event</code>,{' '}
                  <code className="text-foreground font-mono text-[13px]">payload</code>,{' '}
                  <code className="text-foreground font-mono text-[13px]">createdAt</code>,{' '}
                  <code className="text-foreground font-mono text-[13px]">webhookEndpoint</code>
                </Trans>
              </li>
            </ul>
          </section>

          <section id="examples" className="scroll-mt-28 space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                <Trans>Example payloads</Trans>
              </h2>
              <p className="text-muted-foreground">
                <Trans>JSON bodies sent for each supported event.</Trans>
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              value={openExample}
              onValueChange={setOpenExample}
              className="border-t"
            >
              {WEBHOOK_PAYLOAD_EXAMPLES.map(({ event, payload }) => (
                <AccordionItem
                  key={event}
                  value={eventAnchorId(event)}
                  id={eventAnchorId(event)}
                  className="scroll-mt-28"
                >
                  <AccordionTrigger className="py-3 text-left text-sm hover:no-underline">
                    <code className="font-mono text-[13px]">{event}</code>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CopyCodeBlock code={payload} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <section id="testing" className="scroll-mt-28 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                <Trans>Testing and resending</Trans>
              </h2>
              <p className="text-muted-foreground">
                <Trans>
                  On a webhook&apos;s detail page you can send a test event and review call logs.
                  You can also resend a delivery from the call detail view.
                </Trans>
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                <Trans>Availability</Trans>
              </h2>
              <p className="text-muted-foreground">
                <Trans>Webhooks are available on teams.</Trans>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
