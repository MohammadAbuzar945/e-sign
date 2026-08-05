import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type ResellerSaleInvoiceEmailProps = {
  assetBaseUrl: string;
  resellerOrganisationName: string;
  purchaserName: string;
  purchaserEmail: string;
  purchaserOrganisationName: string;
  invoiceId: string;
  invoiceTitle: string;
  credits: number;
  amountLabel: string;
  salesHistoryUrl: string;
};

export const ResellerSaleInvoiceEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3000',
  resellerOrganisationName = 'Reseller Organisation',
  purchaserName = 'Buyer Name',
  purchaserEmail = 'buyer@example.com',
  purchaserOrganisationName = 'Buyer Organisation',
  invoiceId = 'reseller_1',
  invoiceTitle = 'Credit purchase',
  credits = 0,
  amountLabel = 'ZAR 0.00',
  salesHistoryUrl = 'http://localhost:3000',
}: ResellerSaleInvoiceEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Your reseller sale invoice is ready`)}</Preview>

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
              <Trans>Sale invoice</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Hi {resellerOrganisationName}, a client purchased credits through your affiliate
                page. Your sale invoice is attached to this email.
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

            <Section className="mt-4">
              <Text className="text-sm">
                <Trans>Invoice:</Trans> {invoiceTitle}
              </Text>
              <Text className="text-sm">
                <Trans>Invoice #:</Trans> {invoiceId}
              </Text>
              <Text className="text-sm">
                <Trans>Credits:</Trans> {credits}
              </Text>
              <Text className="text-sm">
                <Trans>Amount:</Trans> {amountLabel}
              </Text>
            </Section>

            <Text className="mt-4 text-sm">
              <Trans>You can also download sale invoices anytime from your sales records:</Trans>
            </Text>

            <Link href={salesHistoryUrl} className="text-sm text-blue-600">
              {salesHistoryUrl}
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

export default ResellerSaleInvoiceEmailTemplate;
