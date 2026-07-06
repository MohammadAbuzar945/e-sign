import { getSiteSettings } from './get-site-settings';
import { SITE_SETTINGS_RESELLER_ID } from './schemas/reseller';

export const getResellerSiteSettings = async () => {
  const settings = await getSiteSettings();
  const resellerSetting = settings.find((setting) => setting.id === SITE_SETTINGS_RESELLER_ID);

  return resellerSetting?.data ?? null;
};
