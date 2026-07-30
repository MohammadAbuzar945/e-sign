import { getNomiaApiBaseUrl } from './fetch-template-variables';

export type NomiaWorkspaceEsignSettings = {
  apiKey: string | null;
  folderId: string | null;
};

export type FetchWorkspaceEsignSettingsOptions = {
  organizationId: number;
  workspaceId: number;
  credentials: {
    apiUrl?: string;
    authToken: string;
  };
};

/**
 * Fetches Nomia DocGen workspace e-sign settings.
 * GET /organizations/:orgId/workspaces/:workspaceId/esign_settings
 */
export const fetchWorkspaceEsignSettings = async ({
  organizationId,
  workspaceId,
  credentials,
}: FetchWorkspaceEsignSettingsOptions): Promise<NomiaWorkspaceEsignSettings> => {
  const authToken = credentials.authToken.trim();

  if (!authToken) {
    throw new Error('Nomia DocGen auth token is not configured in Admin Site Settings.');
  }

  const baseUrl = getNomiaApiBaseUrl(credentials.apiUrl);
  const requestUrl = `${baseUrl}/organizations/${organizationId}/workspaces/${workspaceId}/esign_settings`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: authToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch Nomia workspace e-sign settings (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as {
    esign_settings?: {
      api_key?: string | null;
      folder_id?: string | null;
    } | null;
  };

  const apiKey = result.esign_settings?.api_key?.trim() || null;
  const folderId = result.esign_settings?.folder_id?.trim() || null;

  return {
    apiKey,
    folderId,
  };
};

export const hasWorkspaceEsignApiKeyConfigured = (
  settings: NomiaWorkspaceEsignSettings | null | undefined,
) => Boolean(settings?.apiKey);
