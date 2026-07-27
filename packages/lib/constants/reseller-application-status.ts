export const RESELLER_TERMS_REJECTION_PREFIX = 'Rejected by reseller';

export const RESELLER_ADMIN_VIEW = {
  QUEUE: 'queue',
  ACCOUNTS: 'accounts',
  CLOSED: 'closed',
} as const;

export type ResellerAdminView = (typeof RESELLER_ADMIN_VIEW)[keyof typeof RESELLER_ADMIN_VIEW];

export const RESELLER_ADMIN_VIEW_STATUSES: Record<ResellerAdminView, string[]> = {
  [RESELLER_ADMIN_VIEW.QUEUE]: ['PENDING', 'TERMS_SENT', 'TERMS_COMPLETED'],
  [RESELLER_ADMIN_VIEW.ACCOUNTS]: ['APPROVED'],
  [RESELLER_ADMIN_VIEW.CLOSED]: ['REJECTED', 'CANCELLED'],
};

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

  switch (status) {
    case 'PENDING':
      return 'Pending review';
    case 'TERMS_SENT':
      return 'Terms sent';
    case 'TERMS_COMPLETED':
      return 'Terms signed';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
};

export const getResellerProfileStatusLabel = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'INACTIVE':
      return 'Inactive';
    case 'SUSPENDED':
      return 'Suspended';
    case 'DELETED':
      return 'Deleted';
    default:
      return status;
  }
};

export const isResellerAdminView = (value: string | null | undefined): value is ResellerAdminView => {
  return (
    value === RESELLER_ADMIN_VIEW.QUEUE ||
    value === RESELLER_ADMIN_VIEW.ACCOUNTS ||
    value === RESELLER_ADMIN_VIEW.CLOSED
  );
};
