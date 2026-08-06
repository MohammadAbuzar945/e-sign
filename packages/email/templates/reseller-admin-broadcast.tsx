import { Body, Container, Head, Html, Preview, Section } from '../components';
import { TemplateEmailLogo } from '../template-components/template-email-logo';

export type ResellerAdminBroadcastEmailProps = {
  assetBaseUrl: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
};

export const ResellerAdminBroadcastEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  subject = '',
  htmlBody = '',
}: ResellerAdminBroadcastEmailProps) => {
  const previewText = subject.trim() || 'Notification';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <Section className="bg-white text-slate-700">
          <Container className="mx-auto my-0 max-w-xl px-4 py-6">
            <Section style={{ textAlign: 'center' }}>
              <TemplateEmailLogo assetBaseUrl={assetBaseUrl} />
            </Section>

            <div
              className="text-left text-sm leading-6 text-slate-700 [&_a]:text-blue-600 [&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:mb-1 [&_ol]:my-3 [&_ol]:pl-5 [&_p]:my-3 [&_ul]:my-3 [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default ResellerAdminBroadcastEmailTemplate;
