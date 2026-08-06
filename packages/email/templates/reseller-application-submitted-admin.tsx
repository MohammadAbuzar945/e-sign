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

export type ResellerApplicationSubmittedAdminEmailProps = {
  assetBaseUrl: string;
  organisationName: string;
  applicantName: string;
  applicantEmail: string;
  completedDocumentCount: number;
  uniqueSignerCount: number;
  organisationUserCount: number;
  organisationSignupDate: string;
  applicationId: string;
  adminReviewUrl: string;
};

export const ResellerApplicationSubmittedAdminEmailTemplate = ({
  assetBaseUrl = 'http://localhost:4002',
  organisationName = 'Organisation Name',
  applicantName = 'Applicant',
  applicantEmail = 'applicant@example.com',
  completedDocumentCount = 0,
  uniqueSignerCount = 0,
  organisationUserCount = 0,
  organisationSignupDate = 'Unknown',
  applicationId = 'application-id',
  adminReviewUrl = 'http://localhost:3000/admin/reseller-applications',
}: ResellerApplicationSubmittedAdminEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>New Nomia reseller application submitted</Preview>

      <Body className="mx-auto my-auto font-sans">
        <Section className="bg-white text-slate-500">
          <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
            <Section style={{ textAlign: 'center' }}>
              <TemplateEmailLogo assetBaseUrl={assetBaseUrl} />
            </Section>

            <Text className="text-center text-lg font-medium text-black">
              <Trans>New reseller application</Trans>
            </Text>

            <Text className="mt-4 text-left text-sm">
              <Trans>
                A new organisation has applied for the Nomia Reseller Programme. Review the details
                below and take action from the admin panel.
              </Trans>
            </Text>

            <Text className="mt-4 text-left text-sm font-medium text-black">
              <Trans>Application details</Trans>
            </Text>

            <Text className="mt-2 text-left text-sm">
              <Trans>Application ID:</Trans> {applicationId}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Organisation:</Trans> {organisationName}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Applicant:</Trans> {applicantName}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Applicant email:</Trans> {applicantEmail}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Completed documents:</Trans> {completedDocumentCount}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Unique signers:</Trans> {uniqueSignerCount}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Organisation users:</Trans> {organisationUserCount}
            </Text>

            <Text className="my-0 text-left text-sm">
              <Trans>Organisation signup date:</Trans> {organisationSignupDate}
            </Text>

            <Text className="mt-4 text-left text-sm">
              <Trans>Review application:</Trans>
            </Text>

            <Link href={adminReviewUrl} className="block text-left text-sm text-blue-600">
              {adminReviewUrl}
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

export default ResellerApplicationSubmittedAdminEmailTemplate;
