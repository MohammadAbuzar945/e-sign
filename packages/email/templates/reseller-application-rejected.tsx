import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type ResellerApplicationRejectedEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
  applicantName: string;
  rejectionReason?: string | null;
};

export const ResellerApplicationRejectedEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  organisationName = 'Organisation Name',
  applicantName = 'Applicant',
  rejectionReason,
}: ResellerApplicationRejectedEmailProps) => {
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>Update on your Nomia reseller application</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            {branding.brandingEnabled && branding.brandingLogo ? (
              <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-20 p-2" />
            ) : (
              <TemplateImage
                assetBaseUrl={assetBaseUrl}
                className="mb-4 h-16 p-2"
                staticAsset="logo.png"
              />
            )}

            <Text className="text-center text-lg font-medium text-black">
              <Trans>Reseller application update</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Hi {applicantName}, thank you for your interest in the Nomia Reseller Programme for{' '}
                {organisationName}.
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                After reviewing your application, we are unable to approve it at this time. You may
                apply again in the future if your organisation meets the programme requirements.
              </Trans>
            </Text>

            {rejectionReason?.trim() ? (
              <Text className="mt-4 text-sm">
                <Trans>Note from our team: {rejectionReason.trim()}</Trans>
              </Text>
            ) : null}
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

export default ResellerApplicationRejectedEmailTemplate;
