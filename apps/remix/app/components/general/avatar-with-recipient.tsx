import { DocumentStatus } from '@prisma/client';

import { useLingui } from '@lingui/react';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';

import { StackAvatar } from './stack-avatar';

export type AvatarWithRecipientProps = {
  recipient: TRecipientLite;
  documentStatus: DocumentStatus;
};

export function AvatarWithRecipient({ recipient, documentStatus }: AvatarWithRecipientProps) {
  const { _ } = useLingui();
  const signingToken = documentStatus === DocumentStatus.PENDING ? recipient.token : null;

  return (
    <div className="my-1 flex items-center gap-2">
      <StackAvatar
        first={true}
        key={recipient.id}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
      />

      <div className="text-sm text-muted-foreground">
        <p>{recipient.email || recipient.name}</p>
        <p className="text-xs text-muted-foreground/70">
          {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
        </p>
      </div>
    </div>
  );
}