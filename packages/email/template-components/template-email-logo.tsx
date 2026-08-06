import type { CSSProperties } from 'react';

import { Img } from '../components';
import { useBranding } from '../providers/branding';
import TemplateImage from './template-image';

const LOGO_STYLE: CSSProperties = {
  margin: '0 auto 12px',
  display: 'block',
  width: '120px',
  maxWidth: '120px',
  height: 'auto',
  maxHeight: '40px',
};

export type TemplateEmailLogoProps = {
  assetBaseUrl: string;
};

/**
 * Compact Nomia / branding logo for transactional emails.
 * Always set explicit width so clients do not render the native full-size asset.
 */
export const TemplateEmailLogo = ({ assetBaseUrl }: TemplateEmailLogoProps) => {
  const branding = useBranding();

  if (branding.brandingEnabled && branding.brandingLogo) {
    return (
      <Img
        src={branding.brandingLogo}
        alt="Nomia"
        width={120}
        style={LOGO_STYLE}
      />
    );
  }

  return (
    <TemplateImage
      assetBaseUrl={assetBaseUrl}
      staticAsset="logo.png"
      alt="Nomia"
      width={120}
      style={LOGO_STYLE}
    />
  );
};

export default TemplateEmailLogo;
