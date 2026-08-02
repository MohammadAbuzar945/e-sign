import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type ResellerInsufficientCreditsEmailProps = {
  assetBaseUrl: string;
  resellerOrganisationName: string;
  purchaserName: string;
  purchaserEmail: string;
  purchaserOrganisationName: string;
  creditsRequired: number;
  availableCredits: number;
  resellerSettingsUrl: string;
};

export const ResellerInsufficientCreditsEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  resellerOrganisationName = 'Reseller Organisation',
  purchaserName = 'Buyer Name',
  purchaserEmail = 'buyer@example.com',
  purchaserOrganisationName = 'Buyer Organisation',
  creditsRequired = 50,
  availableCredits = 0,
  resellerSettingsUrl = 'http://localhost:3000/o/demo/settings/reseller',
}: ResellerInsufficientCreditsEmailProps) => {
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>Action required: manually transfer credits after a client purchase</Preview>

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
              <Trans>Manual credit transfer required</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Hi {resellerOrganisationName}, a client completed payment through your affiliate
                page, but your organisation did not have enough credits available to top up their
                account automatically.
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>Client details:</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>
                Name: {purchaserName}
                {'\n'}
                Email: {purchaserEmail}
                {'\n'}
                Organisation: {purchaserOrganisationName}
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Credits required: {creditsRequired}
                {'\n'}
                Credits currently available: {availableCredits}
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Please recharge your account if needed, then manually transfer the required credits
                to this client from your reseller dashboard.
              </Trans>
            </Text>

            <Link href={resellerSettingsUrl} className="mt-4 block text-sm text-blue-600">
              {resellerSettingsUrl}
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

export default ResellerInsufficientCreditsEmailTemplate;
