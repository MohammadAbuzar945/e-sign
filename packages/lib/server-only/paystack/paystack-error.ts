type PaystackErrorPayload = {
  message?: string;
  status?: boolean;
};

type AxiosLikeError = {
  message?: string;
  response?: {
    status?: number;
    data?: PaystackErrorPayload | string;
  };
};

const isAxiosLikeError = (error: unknown): error is AxiosLikeError =>
  Boolean(error && typeof error === 'object');

export const getPaystackClientErrorMessage = (
  error: unknown,
  fallback = 'Failed to initialize Paystack transaction',
): string => {
  if (!isAxiosLikeError(error)) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  const payload = error.response?.data;
  const paystackMessage =
    typeof payload === 'string'
      ? payload.trim()
      : typeof payload?.message === 'string'
        ? payload.message.trim()
        : '';

  if (paystackMessage) {
    return paystackMessage;
  }

  if (error.response?.status === 404) {
    return 'Paystack resource not found. The reseller subaccount may be missing or belong to a different Paystack mode (test vs live).';
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

export const isPaystackSubaccountMissingError = (error: unknown): boolean => {
  const message = getPaystackClientErrorMessage(error).toLowerCase();
  const status = isAxiosLikeError(error) ? error.response?.status : undefined;
  const appErrorMessage =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';

  const combined = `${message} ${appErrorMessage}`;

  return (
    status === 404 ||
    combined.includes('subaccount') ||
    combined.includes('status code 404') ||
    combined.includes('not found')
  );
};
