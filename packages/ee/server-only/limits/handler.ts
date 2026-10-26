import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { match } from 'ts-pattern';

import { ERROR_CODES } from './errors';
import { getServerLimits } from './server';

export const limitsHandler = async (req: Request) => {
  console.log('limitsHandler');
  try {
    const { user } = await getSession(req);

    const rawTeamId = req.headers.get('team-id');

    console.log('rawTeamId', rawTeamId);

    let teamId: number | null = null;

    if (typeof rawTeamId === 'string' && !isNaN(parseInt(rawTeamId, 10))) {
      teamId = parseInt(rawTeamId, 10);
    }

    if (!teamId) {
      throw new Error(ERROR_CODES.INVALID_TEAM_ID);
    }

    const limits = await getServerLimits({ userId: user.id, teamId });

    return Response.json(limits, {
      status: 200,
    });
  } catch (err) {
    console.error('Limits API error:', err);

    if (err instanceof Error) {
      // Log full error details for debugging
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);

      // Find the error code key by matching the error message
      const errorCodeKey = Object.keys(ERROR_CODES).find(
        (key) => ERROR_CODES[key] === err.message,
      );

      const errorMessage = errorCodeKey ? ERROR_CODES[errorCodeKey] : err.message || ERROR_CODES.UNKNOWN;
      const status = match(errorCodeKey)
        .with('UNAUTHORIZED', () => 401)
        .otherwise(() => 500);

        console.log('errorMessage', errorMessage);

      return Response.json(
        {
          error: errorMessage,
        },
        {
          status,
        },
      );
    }

    return Response.json(
      {
        error: ERROR_CODES.UNKNOWN,
      },
      {
        status: 500,
      },
    );
  }
};
