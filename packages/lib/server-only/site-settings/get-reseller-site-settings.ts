import { getSiteSettings } from './get-site-settings';
import {
  resolveResellerEligibilityThresholds,
  SITE_SETTINGS_RESELLER_ID,
  type ResellerEligibilityThresholds,
} from './schemas/reseller';

export const getResellerSiteSettings = async () => {
  const settings = await getSiteSettings();
  const resellerSetting = settings.find((setting) => setting.id === SITE_SETTINGS_RESELLER_ID);

  return resellerSetting?.data ?? null;
};

export const getResellerEligibilityThresholds = async (): Promise<ResellerEligibilityThresholds> => {
  const data = await getResellerSiteSettings();

  return resolveResellerEligibilityThresholds(data);
};
