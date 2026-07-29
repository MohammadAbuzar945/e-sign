import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type ResellerAdminBroadcastEmailProps = {
  assetBaseUrl: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
};

export const ResellerAdminBroadcastEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  recipientName = 'Reseller Partner',
  subject = 'Update from Nomia',
  htmlBody = '<p>Your message will appear here.</p>',
}: ResellerAdminBroadcastEmailProps) => {
  const branding = useBranding();
  const previewText = subject.trim() || 'Update from the Nomia Reseller Programme';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Body className="mx-auto my-auto bg-slate-50 font-sans">
        <Section className="bg-slate-50 text-slate-600">
          <Container className="mx-auto mb-2 mt-8 max-w-xl overflow-hidden rounded-lg border border-solid border-slate-200 bg-white">
            <Section className="border-b border-solid border-slate-100 bg-white px-6 py-5">
              {branding.brandingEnabled && branding.brandingLogo ? (
                <Img src={branding.brandingLogo} alt="Branding Logo" className="h-14" />
              ) : (
                <TemplateImage
                  assetBaseUrl={assetBaseUrl}
                  className="h-12"
                  staticAsset="logo.png"
                />
              )}
            </Section>

            <Section className="px-6 pb-2 pt-6">
              <Text className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Trans>Reseller Programme</Trans>
              </Text>

              <Text className="mb-1 mt-3 text-xl font-semibold leading-snug text-slate-900">
                {subject.trim() || 'Update from Nomia'}
              </Text>

              <Text className="mt-4 text-sm leading-6 text-slate-600">
                <Trans>Hi {recipientName},</Trans>
              </Text>
            </Section>

            <Section className="px-6 pb-6">
              <div
                className="text-sm leading-6 text-slate-600 [&_a]:text-blue-600 [&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:mb-1 [&_ol]:my-3 [&_ol]:pl-5 [&_p]:my-3 [&_ul]:my-3 [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            </Section>

            <Section className="border-t border-solid border-slate-100 bg-slate-50 px-6 py-4">
              <Text className="m-0 text-xs leading-5 text-slate-500">
                <Trans>
                  This message was sent to active Nomia resellers. If you have questions, reply to
                  this email or contact your Nomia account team.
                </Trans>
              </Text>
            </Section>
          </Container>

          <Hr className="mx-auto mt-10 max-w-xl border-slate-200" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default ResellerAdminBroadcastEmailTemplate;
