import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, FREE_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';
import { ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
  teamId: number;
};

export const getLimits = async ({ headers, teamId }: GetLimitsOptions) => {
  const requestHeaders = headers ?? {};

  const url = new URL('/api/limits', NEXT_PUBLIC_WEBAPP_URL());

  if (teamId) {
    requestHeaders['team-id'] = teamId.toString();
  }

  // console.log('url', url);
  // console.log('requestHeaders', requestHeaders);
  // console.log('teamId', teamId);

  return fetch(url, {
    headers: {
      ...requestHeaders,
    },
  })
    .then(async (res) => {
      const data = await res.json();
      
      // Check if the response contains an error
      if (!res.ok || 'error' in data) {
        console.error('Limits API error:', data.error || 'Unknown error', 'Status:', res.status);
        throw new Error(data.error || 'Failed to fetch limits');
      }
      
      return data;
    })
    .then((res) => {
      console.log('res', res);
      return ZLimitsResponseSchema.parse(res);
    })
    .catch((_err) => {
      console.error('Error fetching limits, using defaults:', _err);
      return {
        quota: {
          documents: 0,
          recipients: 0,
          directTemplates: 0,
        },
        remaining: {
          documents: 0,
          recipients: 0,
          directTemplates: 0,
        },
        maximumEnvelopeItemCount: 0,
      } satisfies TLimitsResponseSchema;
    });
};
