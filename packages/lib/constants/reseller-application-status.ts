export const RESELLER_TERMS_REJECTION_PREFIX = 'Rejected by reseller';

export const formatResellerTermsRejectionReason = (rejectionReason?: string) => {
  const trimmedReason = rejectionReason?.trim();

  if (trimmedReason) {
    return `${RESELLER_TERMS_REJECTION_PREFIX}: ${trimmedReason}`;
  }

  return RESELLER_TERMS_REJECTION_PREFIX;
};

export const isResellerTermsRejectionReason = (rejectionReason?: string | null) => {
  return rejectionReason?.startsWith(RESELLER_TERMS_REJECTION_PREFIX) ?? false;
};

export const getResellerApplicationStatusLabel = (
  status: string,
  rejectionReason?: string | null,
) => {
  if (status === 'REJECTED' && isResellerTermsRejectionReason(rejectionReason)) {
    return 'Rejected by reseller';
  }

  return status;
};
