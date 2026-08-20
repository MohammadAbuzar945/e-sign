import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Preview, Section, Text } from '../components';
import { TemplateEmailLogo } from '../template-components/template-email-logo';
import { TemplateFooter } from '../template-components/template-footer';

export interface BulkResendCompleteEmailProps {
  userName: string;
  totalRequested: number;
  resentCount: number;
  skippedCount: number;
  failedCount: number;
  failedIds: string[];
  assetBaseUrl?: string;
}

export const BulkResendCompleteEmail = ({
  userName,
  totalRequested,
  resentCount,
  skippedCount,
  failedCount,
  failedIds,
  assetBaseUrl = 'http://localhost:3000',
}: BulkResendCompleteEmailProps) => {
  const { _ } = useLingui();

  return (
    <Html>
      <Head />
      <Preview>{_(msg`Bulk resend complete: ${resentCount} document(s) reminded`)}</Preview>
      <Body className="mx-auto my-auto bg-white font-sans">
        <Section>
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            <Section style={{ textAlign: 'center' }}>
              <TemplateEmailLogo assetBaseUrl={assetBaseUrl} />
            </Section>

            <Section>
              <Text className="text-sm">
                <Trans>Hi {userName},</Trans>
              </Text>

              <Text className="text-sm">
                <Trans>Your bulk resend operation has completed.</Trans>
              </Text>

              <Text className="text-lg font-semibold">
                <Trans>Summary:</Trans>
              </Text>

              <ul className="my-2 ml-4 list-inside list-disc">
                <li>
                  <Trans>Documents requested: {totalRequested}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Reminders sent: {resentCount}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Skipped: {skippedCount}</Trans>
                </li>
                <li className="mt-1">
                  <Trans>Failed: {failedCount}</Trans>
                </li>
              </ul>

              {failedCount > 0 && (
                <Section className="mt-4">
                  <Text className="text-lg font-semibold">
                    <Trans>The following documents could not be reminded:</Trans>
                  </Text>

                  <ul className="my-2 ml-4 list-inside list-disc">
                    {failedIds.map((failedId) => (
                      <li key={failedId} className="text-destructive mt-1 text-sm text-slate-400">
                        {failedId}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </Section>
          </Container>

          <Container className="mx-auto max-w-xl">
            <TemplateFooter isDocument={false} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};
