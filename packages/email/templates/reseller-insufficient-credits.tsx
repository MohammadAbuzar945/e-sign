import { Trans } from '@lingui/react/macro';

import {
  Body,
  Button,
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

const COLORS = {
  page: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#F7F7F8',
  border: '#E6E6E8',
  text: '#111111',
  muted: '#5C5C66',
  accent: '#1B2430',
  link: '#334155',
  warning: '#8A4B08',
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
  return (
    <Html>
      <Head />
      <Preview>Action required: manually transfer credits after a client purchase</Preview>

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
              <Trans>Manual credit transfer required</Trans>
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
              A client completed payment through your affiliate page, but your organisation did not
              have enough credits available to top up their account automatically.
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
              <Trans>Credit status</Trans>
            </Text>

            <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
              <span style={{ color: COLORS.muted }}><Trans>Credits required:</Trans></span>{' '}
              {creditsRequired}
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: '22px',
                lineHeight: '28px',
                fontWeight: 700,
                color: COLORS.warning,
                letterSpacing: '-0.02em',
              }}
            >
              <Trans>Available:</Trans> {availableCredits}
            </Text>
          </Section>

          <Text
            style={{
              margin: '20px 0 0',
              fontSize: '14px',
              lineHeight: '22px',
              color: COLORS.muted,
              textAlign: 'left',
            }}
          >
            <Trans>
              Please recharge your account if needed, then manually transfer the required credits to
              this client from your reseller dashboard.
            </Trans>
          </Text>

          <Section style={{ marginTop: '28px', textAlign: 'center' }}>
            <Button
              href={resellerSettingsUrl}
              style={{
                display: 'inline-block',
                backgroundColor: COLORS.accent,
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 600,
                lineHeight: '44px',
                minHeight: '44px',
                padding: '0 28px',
                borderRadius: '8px',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              <Trans>Open reseller dashboard</Trans>
            </Button>
          </Section>
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

export default ResellerInsufficientCreditsEmailTemplate;
