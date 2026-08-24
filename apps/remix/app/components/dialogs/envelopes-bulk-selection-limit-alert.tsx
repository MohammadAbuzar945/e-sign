import { Trans } from '@lingui/react/macro';

import { MAX_ENVELOPE_IDS_PER_REQUEST } from '@documenso/lib/utils/envelope';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';

export { MAX_ENVELOPE_IDS_PER_REQUEST };

export const isBulkSelectionOverLimit = (selectedCount: number) => {
  return selectedCount > MAX_ENVELOPE_IDS_PER_REQUEST;
};

export type EnvelopesBulkSelectionLimitAlertProps = {
  selectedCount: number;
};

export const EnvelopesBulkSelectionLimitAlert = ({
  selectedCount,
}: EnvelopesBulkSelectionLimitAlertProps) => {
  if (!isBulkSelectionOverLimit(selectedCount)) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>
        <Trans>
          You have selected {selectedCount} items, but you can only process up to{' '}
          {MAX_ENVELOPE_IDS_PER_REQUEST} at a time. Please deselect some items and try again.
        </Trans>
      </AlertDescription>
    </Alert>
  );
};
