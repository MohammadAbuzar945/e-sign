import { Trans } from '@lingui/react/macro';

import { Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import { env } from '@documenso/lib/utils/env';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();

  return (
    <Section style={{ textAlign: 'center' }}>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-base text-slate-400" style={{ textAlign: 'center' }}>
          <Trans>
            This document was sent using{' '}
            <Link className="text-[#3346b1]" href={env('NEXT_PUBLIC_WEBAPP_URL') ?? 'http://localhost:3000'}>
              Nomia
            </Link>
            .
          </Trans>
        </Text>
      )}

      {branding.brandingEnabled && branding.brandingCompanyDetails && (
        <Text className="my-8 text-sm text-slate-400" style={{ textAlign: 'center' }}>
          {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      )}

      {!branding.brandingEnabled && (
        <Text className="my-4 text-sm text-slate-400" style={{ textAlign: 'center', margin: '8px 0' }}>
          Nomia Africa (Pty) Ltd.
        </Text>
      )}
    </Section>
  );
};

export default TemplateFooter;
