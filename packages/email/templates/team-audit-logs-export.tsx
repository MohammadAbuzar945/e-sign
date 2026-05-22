import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';
import { env } from '@documenso/lib/utils/env';

export type TeamAuditLogsExportEmailProps = {
  assetBaseUrl?: string;
  baseUrl?: string;
  downloadUrl: string;
  teamName: string;
};

export const TeamAuditLogsExportEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  baseUrl = env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000',
  downloadUrl,
  teamName,
}: TeamAuditLogsExportEmailProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Your team audit logs export is ready`;

  const title = msg`Your team audit logs export is ready`;

  const description = msg`We have generated a CSV export of the audit logs for team "${teamName}". You can download it using the link below.`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

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

            <Section className="p-2 text-slate-500">
              <Text className="text-center text-lg font-medium text-black">{_(title)}</Text>

              <Text className="my-3 text-center text-base">{_(description)}</Text>

              <div className="my-4 text-center">
                <Link
                  href={downloadUrl}
                  className="inline-block rounded-md bg-black px-5 py-2 text-sm font-medium text-white no-underline"
                >
                  {_(msg`Download CSV`)}
                </Link>
              </div>

              <Text className="mt-4 text-xs text-slate-400">
                {_(msg`If the button above does not work, copy and paste this link into your browser:`)}
              </Text>

              <Text className="break-all text-xs text-slate-500">
                {baseUrl ? downloadUrl.replace(baseUrl, '') : downloadUrl}
              </Text>
            </Section>
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

export default TeamAuditLogsExportEmailTemplate;

