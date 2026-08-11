import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '../components';
import { TemplateEmailLogo } from '../template-components/template-email-logo';
import { TemplateFooter } from '../template-components/template-footer';

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

const COLORS = {
  page: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#F7F7F8',
  border: '#E6E6E8',
  text: '#111111',
  muted: '#5C5C66',
  accent: '#1B2430',
  link: '#334155',
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

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Your reseller sale invoice is ready`)}</Preview>

      <Body
        className="mx-auto my-auto font-sans"
        style={{
          backgroundColor: COLORS.page,
          margin: 0,
          padding: '28px 16px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          className="mx-auto"
          style={{
            maxWidth: '600px',
            backgroundColor: COLORS.surface,
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            padding: '32px 28px',
          }}
        >
          <Section style={{ textAlign: 'center' }}>
            <TemplateEmailLogo assetBaseUrl={assetBaseUrl} />

            <Text
              style={{
                margin: '8px 0 0',
                fontSize: '22px',
                lineHeight: '28px',
                fontWeight: 700,
                color: COLORS.text,
                letterSpacing: '-0.02em',
              }}
            >
              <Trans>Sale Invoice</Trans>
            </Text>
          </Section>

          <Text
            style={{
              margin: '28px 0 0',
              fontSize: '15px',
              lineHeight: '24px',
              color: COLORS.text,
              textAlign: 'left',
            }}
          >
            <Trans>Hi {resellerOrganisationName},</Trans>
          </Text>

          <Text
            style={{
              margin: '8px 0 0',
              fontSize: '15px',
              lineHeight: '24px',
              color: COLORS.muted,
              textAlign: 'left',
            }}
          >
            <Trans>
              A client purchased credits through your affiliate page. Your sale invoice is attached
              to this email.
            </Trans>
          </Text>

          <Section
            style={{
              marginTop: '24px',
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              padding: '18px 20px',
            }}
          >
            <Text
              style={{
                margin: '0 0 12px',
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: COLORS.muted,
              }}
            >
              <Trans>Client details</Trans>
            </Text>

            <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Name:</Trans></span> {purchaserName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Email:</Trans></span>{' '}
              <Link href={`mailto:${purchaserEmail}`} style={{ color: COLORS.accent, textDecoration: 'underline' }}>
                {purchaserEmail}
              </Link>
            </Text>
            <Text style={{ margin: 0, fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Organisation:</Trans></span>{' '}
              {purchaserOrganisationName}
            </Text>
          </Section>

          <Section
            style={{
              marginTop: '16px',
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '10px',
              padding: '18px 20px',
            }}
          >
            <Text
              style={{
                margin: '0 0 12px',
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: COLORS.muted,
              }}
            >
              <Trans>Invoice details</Trans>
            </Text>

            <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Invoice:</Trans></span> {invoiceTitle}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Invoice #:</Trans></span> {invoiceId}
            </Text>
            <Text style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Credits:</Trans></span> {credits}
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: '22px',
                lineHeight: '28px',
                fontWeight: 700,
                color: COLORS.accent,
                letterSpacing: '-0.02em',
              }}
            >
              {amountLabel}
            </Text>
          </Section>

          <Text
            style={{
              margin: '24px 0 0',
              fontSize: '13px',
              lineHeight: '20px',
              color: COLORS.muted,
              textAlign: 'center',
            }}
          >
            <Trans>Your invoice PDF is attached to this email.</Trans>
          </Text>

          <Text
            style={{
              margin: '12px 0 0',
              fontSize: '13px',
              lineHeight: '20px',
              color: COLORS.muted,
              textAlign: 'center',
            }}
          >
            <Link
              href={salesHistoryUrl}
              style={{ color: COLORS.link, textDecoration: 'underline' }}
            >
              <Trans>View all sale invoices in your dashboard</Trans>
            </Link>
          </Text>
        </Container>

        <Container className="mx-auto" style={{ maxWidth: '600px', padding: '20px 8px 8px' }}>
          <Hr style={{ borderColor: COLORS.border, margin: '0 0 16px' }} />
          <Section style={{ textAlign: 'center' }}>
            <TemplateFooter isDocument={false} />
            <Text
              style={{
                margin: '8px 0 0',
                fontSize: '12px',
                lineHeight: '18px',
                color: COLORS.muted,
                textAlign: 'center',
              }}
            >
              <Link href="https://www.nomiadocs.com" style={{ color: COLORS.muted, textDecoration: 'underline' }}>
                nomiadocs.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ResellerSaleInvoiceEmailTemplate;
