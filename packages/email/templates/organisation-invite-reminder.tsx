import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { env } from '@documenso/lib/utils/env';

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type OrganisationInviteReminderEmailProps = {
  assetBaseUrl: string;
  baseUrl: string;
  organisationName: string;
  token: string;
};

/**
 * Reminder for an invitation that is still pending.
 *
 * Deliberately omits any sender identity so the email reads as an automated
 * system notification rather than a message from a specific person.
 */
export const OrganisationInviteReminderEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  baseUrl = env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000',
  organisationName = 'Organisation Name',
  token = '',
}: OrganisationInviteReminderEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Your invitation to join ${organisationName} on Nomia is still pending`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-2 backdrop-blur-sm">
            {branding.brandingEnabled && branding.brandingLogo ? (
              <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-20 p-2" />
            ) : (
              <TemplateImage
                assetBaseUrl={assetBaseUrl}
                className="mb-4 h-16 p-2"
                staticAsset="logo.png"
              />
            )}

            <Section>
              <TemplateImage
                className="mx-auto"
                assetBaseUrl={assetBaseUrl}
                staticAsset="add-user.png"
              />
            </Section>

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">
                <Trans>Your invitation is still waiting</Trans>
              </Text>

              <Text className="my-1 text-center text-base">
                <Trans>This is a reminder that you have a pending invitation to join</Trans>
              </Text>

              <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-base font-medium text-slate-600">
                {organisationName}
              </div>

              <Text className="my-1 text-center text-base">
                <Trans>
                  You can accept or decline the invitation at any time using the buttons below.
                </Trans>
              </Text>

              <Section className="mb-6 mt-6 text-center">
                <Button
                  className="bg-documenso-500 inline-flex items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-medium text-black no-underline"
                  href={`${baseUrl}/organisation/invite/${token}`}
                >
                  <Trans>Accept</Trans>
                </Button>
                <Button
                  className="ml-4 inline-flex items-center justify-center rounded-lg bg-gray-50 px-6 py-3 text-center text-sm font-medium text-slate-600 no-underline"
                  href={`${baseUrl}/organisation/decline/${token}`}
                >
                  <Trans>Decline</Trans>
                </Button>
              </Section>

              <Text className="my-1 text-center text-xs text-slate-400">
                <Trans>This is an automated reminder. Please do not reply to this email.</Trans>
              </Text>
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default OrganisationInviteReminderEmailTemplate;
