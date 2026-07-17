import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

export type PurchaseInvoiceEmailProps = {
  assetBaseUrl: string;
  customerName: string;
  organisationName: string;
  invoiceTitle: string;
  invoiceId: string;
  credits: number;
  amountLabel: string;
  purchaseHistoryUrl: string;
};

export const PurchaseInvoiceEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3000',
  customerName = 'Customer',
  organisationName = 'Organisation',
  invoiceTitle = 'Credit purchase',
  invoiceId = 'invoice_1',
  credits = 0,
  amountLabel = 'ZAR 0.00',
  purchaseHistoryUrl = 'http://localhost:3000',
}: PurchaseInvoiceEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Your Nomia purchase invoice is ready`)}</Preview>

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
              <Trans>Your purchase invoice</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                Hi {customerName}, your e-sign credits for {organisationName} have been added
                successfully. Your invoice is attached to this email.
              </Trans>
            </Text>

            <Text className="mt-4 text-sm">
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

            <Text className="mt-4 text-sm">
              <Trans>You can also download invoices anytime from your purchase history:</Trans>
            </Text>

            <Link href={purchaseHistoryUrl} className="text-sm text-blue-600">
              {purchaseHistoryUrl}
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

export default PurchaseInvoiceEmailTemplate;
