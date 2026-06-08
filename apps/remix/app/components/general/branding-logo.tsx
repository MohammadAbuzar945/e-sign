import { cn } from '@documenso/ui/lib/utils';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ className, ...props }: LogoProps) => (
  <>
    <img
      src="/static/logo.png"
      alt="Nomia Signatures"
      className={cn('h-14 w-auto dark:hidden', className)}
      {...props}
    />

    <img
      src="/static/Asset 9.png"
      alt="Nomia Signatures"
      className={cn('hidden h-14 w-auto dark:inline', className)}
      {...props}
    />
  </>
);
