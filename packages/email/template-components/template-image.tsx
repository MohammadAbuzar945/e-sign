import type { CSSProperties } from 'react';

import { Img } from '../components';

export type TemplateImageProps = {
  assetBaseUrl: string;
  className?: string;
  staticAsset: string;
  /** Explicit width helps email clients (Outlook) avoid huge native image sizes. */
  width?: number;
  height?: number;
  style?: CSSProperties;
  alt?: string;
};

export const TemplateImage = ({
  assetBaseUrl,
  className,
  staticAsset,
  width,
  height,
  style,
  alt = '',
}: TemplateImageProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Img
      className={className}
      src={getAssetUrl(`/static/${staticAsset}`)}
      alt={alt}
      width={width}
      height={height}
      style={style}
    />
  );
};

export default TemplateImage;
