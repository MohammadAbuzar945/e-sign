import { useState } from 'react';

import { Trans } from '@lingui/react/macro';

import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';

import { useRequiredDocumentSigningAuthContext } from '../document-signing/document-signing-auth-provider';
import { DirectTemplateAccessAuthKBAForm } from './direct-template-access-auth-kba-form';

type DirectTemplateKbaAccessGateProps = {
  token: string;
  children: React.ReactNode;
};

export const DirectTemplateKbaAccessGate = ({
  token,
  children,
}: DirectTemplateKbaAccessGateProps) => {
  const { derivedRecipientAccessAuth } = useRequiredDocumentSigningAuthContext();
  const requiresKba = derivedRecipientAccessAuth.includes(DocumentAccessAuth.KBA);
  const [isKbaVerified, setIsKbaVerified] = useState(false);

  if (!requiresKba || isKbaVerified) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center px-4">
      <div className="w-full rounded-lg border bg-background p-6 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">
            <Trans>Security verification required</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Trans>Please answer this security question to continue.</Trans>
          </p>
        </div>

        <DirectTemplateAccessAuthKBAForm token={token} onSubmit={() => setIsKbaVerified(true)} />
      </div>
    </div>
  );
};
