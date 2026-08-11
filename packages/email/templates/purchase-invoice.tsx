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

export type PurchaseInvoiceEmailLine = {
  invoiceTitle: string;
  invoiceId: string;
  credits: number;
  amountLabel: string;
};

export type PurchaseInvoiceEmailProps = {
  assetBaseUrl: string;
  customerName: string;
  organisationName: string;
  invoices: PurchaseInvoiceEmailLine[];
  totalCredits: number;
  totalAmountLabel: string;
  purchaseHistoryUrl: string;
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

export const PurchaseInvoiceEmailTemplate = ({
  assetBaseUrl = 'http://localhost:3000',
  customerName = 'Customer',
  organisationName = 'Organisation',
  invoices = [
    {
      invoiceTitle: 'Credit purchase',
      invoiceId: 'invoice_1',
      credits: 0,
      amountLabel: 'ZAR 0.00',
    },
  ],
  totalCredits = 0,
  totalAmountLabel = 'ZAR 0.00',
  purchaseHistoryUrl = 'http://localhost:3000',
}: PurchaseInvoiceEmailProps) => {
  const { _ } = useLingui();
  const isSplitPurchase = invoices.length > 1;

  return (
    <Html>
      <Head />
      <Preview>
        {isSplitPurchase
          ? _(msg`Your Nomia purchase invoices are ready`)
          : _(msg`Your Nomia purchase invoice is ready`)}
      </Preview>

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
              {isSplitPurchase ? (
                <Trans>Your purchase invoices</Trans>
              ) : (
                <Trans>Purchase Invoice</Trans>
              )}
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
            <Trans>Hi {customerName},</Trans>
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
            {isSplitPurchase ? (
              <Trans>
                Your e-sign credits for {organisationName} have been added successfully. Both
                invoices for this purchase are attached to this email.
              </Trans>
            ) : (
              <Trans>
                Your e-sign credits for {organisationName} have been added successfully. Your
                invoice is attached to this email.
              </Trans>
            )}
          </Text>

          {invoices.map((invoice) => (
            <Section
              key={invoice.invoiceId}
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
                <span style={{ color: COLORS.muted }}><Trans>Invoice:</Trans></span> {invoice.invoiceTitle}
              </Text>
              <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
                <span style={{ color: COLORS.muted }}><Trans>Invoice #:</Trans></span> {invoice.invoiceId}
              </Text>
              <Text style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
                <span style={{ color: COLORS.muted }}><Trans>Credits:</Trans></span> {invoice.credits}
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
                {invoice.amountLabel}
              </Text>
            </Section>
          ))}

          {isSplitPurchase ? (
            <Section
              style={{
                marginTop: '16px',
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              <Text style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '22px', color: COLORS.text }}>
                <span style={{ color: COLORS.muted }}><Trans>Total credits:</Trans></span> {totalCredits}
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
                {totalAmountLabel}
              </Text>
            </Section>
          ) : null}

          <Text
            style={{
              margin: '24px 0 0',
              fontSize: '13px',
              lineHeight: '20px',
              color: COLORS.muted,
              textAlign: 'center',
            }}
          >
            {isSplitPurchase ? (
              <Trans>Your invoice PDFs are attached to this email.</Trans>
            ) : (
              <Trans>Your invoice PDF is attached to this email.</Trans>
            )}
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
              href={purchaseHistoryUrl}
              style={{ color: COLORS.link, textDecoration: 'underline' }}
            >
              <Trans>View all invoices in your purchase history</Trans>
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

export default PurchaseInvoiceEmailTemplate;
