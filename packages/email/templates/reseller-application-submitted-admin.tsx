import { Trans } from '@lingui/react/macro';

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '../components';
import { useBranding } from '../providers/branding';
import { TemplateFooter } from '../template-components/template-footer';
import TemplateImage from '../template-components/template-image';

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
  const branding = useBranding();

  return (
    <Html>
      <Head />
      <Preview>New Nomia reseller application submitted</Preview>

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
              <Trans>New reseller application</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>
                A new organisation has applied for the Nomia Reseller Programme. Review the details
                below and take action from the admin panel.
              </Trans>
            </Text>

            <Text className="mt-4 text-sm font-medium text-black">
              <Trans>Application details</Trans>
            </Text>

            <Text className="mt-2 text-sm">
              <Trans>Application ID: {applicationId}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Organisation: {organisationName}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Applicant: {applicantName}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Applicant email: {applicantEmail}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Completed documents: {completedDocumentCount}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Unique signers: {uniqueSignerCount}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Organisation users: {organisationUserCount}</Trans>
            </Text>

            <Text className="text-sm">
              <Trans>Organisation signup date: {organisationSignupDate}</Trans>
            </Text>

            <Text className="mt-4 text-sm">
              <Trans>Review application:</Trans>
            </Text>

            <Link href={adminReviewUrl} className="text-sm text-blue-600">
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
