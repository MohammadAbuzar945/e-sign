import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';
import { env } from '@documenso/lib/utils/env';

export type ResellerWelcomeEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
  applicantName: string;
  affiliateUrl: string;
};

export const ResellerWelcomeEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  organisationName = 'Organisation Name',
  applicantName = 'Applicant',
  affiliateUrl = 'http://localhost:3000/r/demo',
}: ResellerWelcomeEmailProps) => {
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>Welcome to the Nomia Reseller Programme</Preview>

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
              <Trans>Welcome to the Nomia Reseller Programme</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Hi {applicantName}, your organisation {organisationName} has been approved as a
                reseller. You can now configure your reseller settings and share your affiliate link
                with clients.
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>Your affiliate link:</Trans>
            </Text>

            <Link href={affiliateUrl} className="text-sm text-blue-600">
              {affiliateUrl}
            </Link>
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

export default ResellerWelcomeEmailTemplate;
